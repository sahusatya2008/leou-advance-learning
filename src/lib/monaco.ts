import { loader } from "@monaco-editor/react";

/**
 * Where Monaco's own files come from.
 *
 * `@monaco-editor/react` ships pointing at jsdelivr, and the app's CSP allows
 * only same-origin scripts, so that request was blocked outright: `window.monaco`
 * never appeared and the editor rendered nothing at all - a blank space where
 * the code box should be.
 *
 * The AMD build under `/public/vendor/monaco/vs` is served by our own origin,
 * which the CSP allows, and it resolves its modules, its stylesheet and its web
 * workers relative to `loader.js`, so overriding this one path is enough. It
 * also means the workspace keeps working with no internet at all.
 *
 * Re-vendoring: `npm i -D monaco-editor@<version>` then copy `min/vs` to
 * `public/vendor/monaco/vs`.
 */
loader.config({ paths: { vs: "/vendor/monaco/vs" } });
