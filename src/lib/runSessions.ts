/**
 * In-memory ownership of live runner sessions.
 *
 * A session id is a bare string handed back by the runner, so nothing about who
 * owns it travels with it. Every route that touches a session must be able to
 * prove the caller started it, which is what this map is for.
 *
 * Two kinds of session exist, and they are deliberately not interchangeable: an
 * assessment session is bound to a submission + assessment question, a practical
 * session to a practical attempt. The `kind` discriminator keeps each route from
 * reaching for fields that are not there.
 *
 * Note this lives in the app process, so a redeploy drops live sessions. That is
 * acceptable here: the student's work is already persisted on the attempt row, and
 * the client surfaces the lost session as a stop rather than losing the code.
 */
export type RunSessionOwner =
  | {
      kind: "ASSESSMENT";
      studentProfileId: string;
      submissionId: string;
      assessmentQuestionId: string;
    }
  | {
      kind: "PRACTICAL";
      studentProfileId: string;
      practicalAttemptId: string;
      practicalQuestionId: string;
    };

const owner = new Map<string, RunSessionOwner>();

export function claimSession(sessionId: string, o: RunSessionOwner) {
  owner.set(sessionId, o);
}

export function getSessionOwner(sessionId: string): RunSessionOwner | undefined {
  return owner.get(sessionId);
}

export function releaseSession(sessionId: string) {
  owner.delete(sessionId);
}