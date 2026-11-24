"""Read a UPI payment confirmation off a camera frame.

A student holds their payment app up to the phone instead of typing a
transaction id. Phone screens are a hostile input for OCR - small glyphs, low
contrast, glare, dark mode - so this is deliberately forgiving: the frame is
sharpened and contrast-stretched before it is read, and the id is then matched
against the shapes UPI apps actually print.

Nothing here decides whether a payment happened. It only proposes a transaction
id for the student to confirm before anything is submitted; the admin makes the
real decision.
"""

from __future__ import annotations

import base64
import binascii
import logging
import re

import cv2
import numpy as np
import pytesseract

logger = logging.getLogger("face-service.ocr")

# UPI reference numbers are long digit runs, often with one separator. Tesseract
# likes to read 0/O, 1/l/I and 5/S interchangeably, so those are folded together.
_DIGIT_FIXES = str.maketrans({"O": "0", "o": "0", "D": "0", "Q": "0", "l": "1", "I": "1", "|": "1", "S": "5", "B": "8", "Z": "2", "G": "6"})

# Labels that mark the interesting number on a UPI receipt.
_LABEL_HINTS = (
    "utr",
    "transaction",
    "txn",
    "ref",
    "reference",
    "rrn",
    "order",
    "payment id",
)

_MIN_LEN = 6
_MAX_LEN = 32

# Labels that precede the money on a UPI receipt. Indian apps print the amount in
# wildly different ways, so both the symbol and the bare "Rs"/"INR" forms count.
_AMOUNT_HINTS = (
    "amount",
    "amt",
    "paid",
    "total",
    "amount paid",
    "amount sent",
    "amount transferred",
    "rs.",
    "rs ",
    "inr",
    "₹",
)

# Date and time labels. Payment receipts show either a timestamp or a split
# date + time, and phone apps favour the "02 Oct 2025, 14:03" shape.
_DATE_HINTS = ("date", "time", "paid on", "completed", "timestamp", "on ")
_TIME_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm)?\b", re.I)
_DATE_RES = (
    re.compile(r"\b(\d{1,4})[\s\-/](\d{1,2})[\s\-/](\d{2,4})\b"),
    # The spaces around a month name are optional on purpose: tesseract frequently
    # renders "29 Sep 2026" as "29Sep2026" on a photographed receipt, and a
    # strict \s+ there threw the date away on an otherwise clean screen.
    re.compile(r"\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{2,4})\b", re.I),
    re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{1,2}),?\s*(\d{2,4})\b", re.I),
)
_MONTHS = {m: i + 1 for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"))}

# Digits that OCR routinely produces in place of letters. Used only to compare
# label words, never to rewrite the reference itself.
_DIGIT_TO_LETTER = str.maketrans({"1": "i", "0": "o", "5": "s", "8": "b", "2": "z"})


def _decode_data_url(data_url: str) -> np.ndarray | None:
    """base64 -> greyscale numpy array, or None if it is not an image."""
    if not data_url.startswith("data:image/"):
        return None
    _, _, payload = data_url.partition(",")
    if not payload:
        return None
    try:
        raw = base64.b64decode(payload, validate=False)
    except (binascii.Error, ValueError):
        return None
    buf = np.frombuffer(raw, dtype=np.uint8)
    if buf.size == 0:
        return None
    img = cv2.imdecode(buf, cv2.IMREAD_GRAYSCALE)
    return img


def _prepare(gray: np.ndarray) -> list[np.ndarray]:
    """Variants worth trying; a phone photo is never uniformly readable."""
    # Upscale: tesseract is markedly better on larger glyphs.
    scaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    blurred = cv2.GaussianBlur(scaled, (3, 3), 0)
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 12
    )
    return [scaled, binary]


def _clean(token: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", token).translate(_DIGIT_FIXES)


# Tesseract routinely glues a label onto the digits that follow it, turning
# "UTR 428193756201" into one token "UTR428193756201". Handing that to the admin
# would send them looking for a reference that does not exist, so the label is
# peeled back off and only the identifier is kept.
_LABEL_WORDS = (
    "transactionid", "transaction", "utrnumber", "utrno", "utrid", "utr",
    "rrnnumber", "rrnno", "rrn", "txnid", "txnno", "txn", "refno", "refid",
    "referenceid", "reference", "ref", "orderid", "order", "paymentid",
    "payment", "id", "no", "number",
)


def _strip_label(token: str) -> str:
    """Drop a leading label word, longest match first."""
    lowered = token.lower()
    # OCR routinely swaps letters for lookalike digits ("UPI" -> "UP1"), which
    # hides the label from a literal prefix match and leaves it glued onto the
    # reference. Match the label against a letter-normalised view of the *same*
    # characters, then cut the original at that offset.
    for view in (lowered, lowered.translate(_DIGIT_TO_LETTER)):
        for word in _LABEL_WORDS:
            if view.startswith(word) and len(token) > len(word):
                rest = token[len(word) :]
                # A label peel is only believable if what is left is mostly digits.
                if sum(c.isdigit() for c in rest) / max(len(rest), 1) >= 0.6:
                    return rest
    return token


def _candidates(text: str) -> list[tuple[str, float]]:
    """Every plausible reference in the text, best first.

    Preference is for numbers sitting under a label such as "UTR" or
    "Transaction ID", because the largest bare number on a receipt is often the
    amount or a timestamp.
    """
    labelled: list[tuple[str, float]] = []
    unlabelled: list[tuple[str, float]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lowered = line.lower()
        # A label anywhere on the line boosts every number on that line.
        boost = 0.0
        if any(h in lowered for h in _LABEL_HINTS):
            boost = 0.5

        for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9\-]{3,}", line):
            cleaned = _strip_label(_clean(token))
            if not (6 <= len(cleaned) <= _MAX_LEN):
                continue
            mostly_digits = sum(c.isdigit() for c in cleaned) / len(cleaned)
            if mostly_digits < 0.6:
                continue
            score = boost + min(mostly_digits, 1.0) * 0.3
            if boost > 0:
                # Prefer the numbers that follow the label on that line.
                score += 0.1
                labelled.append((cleaned, score))
            else:
                unlabelled.append((cleaned, score))

    seen: set[str] = set()
    ordered: list[tuple[str, float]] = []
    for token, score in sorted(labelled + unlabelled, key=lambda t: -t[1]):
        if token in seen:
            continue
        seen.add(token)
        ordered.append((token, round(score, 3)))
    return ordered


def _extract_amount(text: str) -> dict | None:
    """The money paid on the receipt.

    Prefers a number that sits on a line carrying an amount label, because the
    largest bare number on a UPI receipt is far more often the UTR or a timestamp
    than the amount. "₹1,315.00", "Rs 1315", "INR 1315" and a bare 1315 all work.
    """
    labelled: list[tuple[float, float]] = []
    unlabelled: list[tuple[float, float]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lowered = line.lower()
        boost = 0.5 if any(h in lowered for h in _AMOUNT_HINTS) else 0.0

        # Dates and times must be taken out of the line before hunting for money,
        # or their digits are read as an amount: "2025-10-02" offered up "10".
        scrubbed = _TIME_RE.sub(" ", line)
        for pattern in _DATE_RES:
            scrubbed = pattern.sub(" ", scrubbed)

        for match in re.finditer(r"(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", scrubbed, re.I):
            raw = match.group(1).replace(",", "")
            try:
                value = float(raw)
            except ValueError:
                continue
            # Reject things that are obviously not money: a 4-digit year, a bare
            # phone number fragment, or a UPI reference read as an amount.
            if value < 1 or value > 10_000_000:
                continue
            if re.fullmatch(r"(19|20)\d{2}", raw):
                continue
            if "." not in raw and value == int(value) and 1900 <= value <= 2100:
                continue
            score = boost + (0.2 if match.group(0).strip().startswith(("₹", "Rs", "rs", "INR", "inr")) else 0.0)
            (labelled if boost else unlabelled).append((score, value))

    pool = sorted(labelled or unlabelled, key=lambda t: -t[0])
    if not pool:
        return None
    return {"value": round(pool[0][1], 2), "confidence": round(min(pool[0][0] + 0.3, 1.0), 3)}


def _extract_datetime(text: str) -> dict | None:
    """When the payment was made, as an ISO-ish date and a 24h time.

    A UPI receipt is evidence only if it was produced around the time the student
    says they paid, so the admin needs this at a glance.
    """
    date_out: str | None = None
    time_out: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if time_out is None and _TIME_RE.search(line):
            h, m, s, ap = _TIME_RE.search(line).groups()
            hour = int(h)
            if ap:
                # 12h clock. "12:44 pm" is 12:44, "12:44 am" is 00:44, and only
                # 1-11 shift by twelve. Doing the modulo first turned "12:44 pm"
                # into "00:44", which is a whole day wrong on a receipt.
                marker = ap.lower()
                if marker == "pm" and hour < 12:
                    hour += 12
                elif marker == "am" and hour == 12:
                    hour = 0
            time_out = f"{hour:02d}:{m}" + (f":{s}" if s else "")

        if date_out is not None:
            continue
        for pattern in _DATE_RES:
            match = pattern.search(line)
            if not match:
                continue
            groups = match.groups()
            try:
                if groups[1][:3].lower() in _MONTHS:  # "2 Oct 2025"
                    day, month, year = int(groups[0]), _MONTHS[groups[1][:3].lower()], int(groups[2])
                elif groups[0][:3].lower() in _MONTHS:  # "Oct 2, 2025"
                    month, day, year = _MONTHS[groups[0][:3].lower()], int(groups[1]), int(groups[2])
                else:  # numeric date: "02/10/2025" or "2025-10-02"
                    first, second, year = int(groups[0]), int(groups[1]), int(groups[2])
                    # A leading group of four digits is an ISO year, not a day.
                    # Without this, "2025-10-02" reads as day=2025 and the
                    # month/day swap below silently produces 2009-02-10.
                    if len(groups[0]) == 4 or first > 31:
                        year, month, day = first, second, int(groups[2])
                    elif second > 12:
                        day, month = first, second
                        year = year
                    else:
                        # Genuinely ambiguous (both <= 12). Indian receipts are
                        # day-first, so prefer that.
                        day, month = first, second
                if year < 100:
                    year += 2000
                if not (1 <= month <= 12 and 1 <= day <= 31 and 2000 <= year <= 2100):
                    continue
                date_out = f"{year:04d}-{month:02d}-{day:02d}"
                break
            except (ValueError, KeyError):
                continue

    if date_out is None and time_out is None:
        return None
    return {"date": date_out, "time": time_out}


def _extract_payee(text: str) -> str | None:
    """Who was paid, so the admin can tell a payment to us from a payment to
    someone else entirely."""
    # "Paid to" is the one phrase a receipt always spells out, but tesseract
    # happily returns "PaidtoLEOQU" with the space gone, so the separator between
    # the label and the name is matched loosely and only the name is captured.
    match = re.search(
        r"(?:paid\s*to|payee|beneficiary|receiver|sent\s*to)\s*[:\-]?\s*([A-Za-z][A-Za-z .&]{1,38})",
        text,
        re.I,
    )
    if match:
        name = match.group(1).strip(" .&-")
        if name and name.lower() not in _AMOUNT_HINTS:
            return name
    return None


def scan_payment(data_url: str) -> dict:
    """Read every field we can off a payment screen.

    Returns the reference plus the amount, timestamp and payee, each with its own
    confidence, so the caller can compare them against the quotation and the
    admin can see exactly what was read and how sure the scan was.
    """
    result = scan_transaction_id(data_url)
    if not result.get("ok"):
        return result

    text = result.get("text", "")
    amount = _extract_amount(text)
    when = _extract_datetime(text)
    payee = _extract_payee(text)

    result["amount"] = amount["value"] if amount else None
    result["amountConfidence"] = amount["confidence"] if amount else 0.0
    result["date"] = when["date"] if when else None
    result["time"] = when["time"] if when else None
    result["payee"] = payee
    return result


def scan_transaction_id(data_url: str) -> dict:
    """Return the best-guess reference plus the raw text, for the student to confirm."""
    gray = _decode_data_url(data_url)
    if gray is None:
        return {"ok": False, "error": "That image could not be read. Try again in better light."}

    text = ""
    for variant in _prepare(gray):
        try:
            # The whitelist must keep , . / and spaces, otherwise amounts and dates
            # are destroyed before they can be parsed: "1,315.00" collapses to
            # "131500" and "02/10/2025" to "02102025".
            found = pytesseract.image_to_string(
                variant,
                config="--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:-/,.()₹ ",
            )
        except Exception:  # tesseract missing/unhappy - fall through to the next variant
            logger.exception("tesseract failed on a frame")
            return {"ok": False, "error": "Text scanning is unavailable right now. Enter the transaction id instead."}
        if found.strip():
            text = found if len(found) > len(text) else text
    if not text.strip():
        return {
            "ok": False,
            "error": "No text found. Hold the payment confirmation flat, filling the frame, and try again.",
        }

    candidates = _candidates(text)
    return {
        "ok": True,
        "transactionId": candidates[0][0] if candidates else "",
        "confidence": candidates[0][1] if candidates else 0.0,
        "alternatives": [c[0] for c in candidates[1:4]],
        "text": text.strip()[:2000],
    }
