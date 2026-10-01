window.__ModuleLoader__.load({
  id: "@mikhail/dsh-telegram",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    try {
      Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    } catch (e) { /* environments without Symbol support */ }
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/panel.tsx
var import_react = require("react");

// src/client/fields.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var TEXT = {
  primary: "var(--dsw-alias-label-primary, currentColor)",
  secondary: "var(--dsw-alias-label-secondary, #6b7280)",
  tertiary: "var(--dsw-alias-label-tertiary, #9ca3af)"
};
var FILL = {
  /** High contrast against the page. Near-black in light, near-white in dark. */
  brand: "var(--dsw-alias-brand-primary, #4d6bfe)",
  /** The shell's own action blue, for a control that is switched on. */
  action: "var(--dsw-alias-button-info-fill, #4176e6)",
  surface: "var(--dsw-alias-bg-layer-1, transparent)",
  /** A neutral track: a border token reads as a faint fill in both themes. */
  neutral: "var(--dsw-alias-border-l2, rgba(128,128,128,0.45))"
};
var COLOR = {
  text: TEXT.primary,
  muted: TEXT.secondary,
  faint: TEXT.tertiary,
  border: "var(--dsw-alias-border-l1, rgba(128,128,128,0.28))",
  borderStrong: "var(--dsw-alias-border-l2, rgba(128,128,128,0.45))",
  surface: FILL.surface,
  accent: FILL.brand,
  danger: "var(--dsw-alias-state-error-primary, #dc2626)",
  success: "var(--dsw-alias-state-success-primary, #16a34a)",
  warn: "var(--dsw-alias-state-warn-primary, #d97706)"
};
function Section(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: { marginBottom: 28 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "h3",
      {
        style: {
          margin: "0 0 12px",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: COLOR.faint
        },
        children: props.title
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          border: `1px solid ${COLOR.border}`,
          borderRadius: 10,
          background: COLOR.surface,
          overflow: "hidden"
        },
        children: props.children
      }
    )
  ] });
}
function Row(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        padding: "14px 16px",
        borderBottom: `1px solid ${COLOR.border}`
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 auto", minWidth: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, color: COLOR.text, fontSize: 14 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: props.label }),
            props.overridden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "span",
              {
                style: {
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 999,
                  color: COLOR.accent,
                  border: `1px solid ${COLOR.accent}`,
                  opacity: 0.85
                },
                children: props.overriddenLabel ?? "changed"
              }
            ) : null,
            props.overridden && props.onReset ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: props.onReset, style: linkButtonStyle, children: props.resetLabel ?? "Reset" }) : null
          ] }),
          props.hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 4, fontSize: 12, lineHeight: 1.5, color: COLOR.muted }, children: props.hint }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }, children: props.children })
      ]
    }
  );
}
function TextInput(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "input",
    {
      type: props.type ?? "text",
      value: props.value,
      placeholder: props.placeholder ?? "",
      disabled: props.disabled ?? false,
      onChange: (event) => props.onChange(event.target.value),
      onBlur: props.onCommit ?? (() => void 0),
      onKeyDown: (event) => {
        if (event.key === "Enter") props.onCommit?.();
      },
      style: {
        width: props.width ?? 220,
        padding: "6px 10px",
        fontSize: 13,
        color: COLOR.text,
        background: "transparent",
        border: `1px solid ${props.invalid ? COLOR.danger : COLOR.borderStrong}`,
        borderRadius: 6,
        outline: "none",
        opacity: props.disabled ? 0.5 : 1
      }
    }
  );
}
function NumberInput(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "input",
    {
      type: "number",
      defaultValue: String(props.value),
      disabled: props.disabled ?? false,
      min: props.min ?? 0,
      onBlur: (event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next) && Number.isInteger(next) && next >= (props.min ?? 0)) {
          if (next !== props.value) props.onCommit(next);
        }
      },
      style: {
        width: 110,
        padding: "6px 10px",
        fontSize: 13,
        color: COLOR.text,
        background: "transparent",
        border: `1px solid ${COLOR.borderStrong}`,
        borderRadius: 6,
        outline: "none",
        opacity: props.disabled ? 0.5 : 1
      }
    },
    props.value
  );
}
function Toggle(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": props.checked,
      disabled: props.disabled ?? false,
      onClick: () => props.onChange(!props.checked),
      style: {
        boxSizing: "border-box",
        // border-box plus these numbers leaves a 34x16 content box, so the
        // knob's travel below is exactly its width.
        width: 40,
        height: 22,
        padding: 2,
        // Never transparent: a track whose colour happens to match the page
        // would otherwise stop reading as a control at all. Off keeps a visible
        // edge; on, the fill already carries the shape.
        border: `1px solid ${props.checked ? "transparent" : COLOR.border}`,
        borderRadius: 999,
        // Blue rather than the brand neutral: "on" should be a colour, not a
        // shade that inverts with the theme and reads as neither state.
        background: props.checked ? FILL.action : FILL.neutral,
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        transition: "background 120ms ease"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          style: {
            display: "block",
            width: 16,
            height: 16,
            borderRadius: "50%",
            // White on both tracks now: the blue is dark enough in either theme
            // for a white knob to carry the contrast, which is also the shape
            // every other switch anyone has used has.
            background: "#fff",
            border: "1px solid rgba(0, 0, 0, 0.12)",
            boxSizing: "border-box",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
            transform: props.checked ? "translateX(18px)" : "translateX(0)",
            transition: "transform 120ms ease"
          }
        }
      )
    }
  );
}
function Select(props) {
  const groups = [...new Set(props.options.map((option) => option.group ?? ""))];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "select",
    {
      value: props.value,
      disabled: props.disabled ?? false,
      onChange: (event) => props.onChange(event.target.value),
      style: {
        width: props.width ?? 240,
        padding: "6px 8px",
        fontSize: 13,
        color: COLOR.text,
        // A transparent select shows the page through its own popup on some
        // platforms; a real surface keeps it readable in both themes.
        background: FILL.surface,
        border: `1px solid ${COLOR.borderStrong}`,
        borderRadius: 6,
        outline: "none",
        opacity: props.disabled ? 0.5 : 1
      },
      children: groups.map((group) => {
        const members = props.options.filter((option) => (option.group ?? "") === group);
        const items = members.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option.value, children: option.label }, option.value));
        return group === "" ? items : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("optgroup", { label: group, children: items }, group);
      })
    }
  );
}
function Button(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      onClick: props.onClick,
      disabled: props.disabled ?? false,
      style: {
        padding: "6px 12px",
        fontSize: 13,
        color: props.tone === "danger" ? COLOR.danger : COLOR.text,
        background: "transparent",
        border: `1px solid ${props.tone === "danger" ? COLOR.danger : COLOR.borderStrong}`,
        borderRadius: 6,
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.45 : 1
      },
      children: props.children
    }
  );
}
function Note(props) {
  const color = props.tone === "good" ? COLOR.success : props.tone === "warn" ? COLOR.warn : props.tone === "bad" ? COLOR.danger : COLOR.muted;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, lineHeight: 1.6, color }, children: props.children });
}
var linkButtonStyle = {
  padding: 0,
  fontSize: 11,
  color: COLOR.muted,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  textDecoration: "underline"
};

// src/client/panel.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function TelegramPanel({ scope, remote, t }) {
  const snapshot = useSettingsSnapshot(scope);
  const [failure, setFailure] = (0, import_react.useState)();
  const write = (0, import_react.useCallback)(
    (field, value2) => {
      setFailure(void 0);
      void scope.set(field, value2).catch((error) => {
        setFailure(error instanceof Error ? error.message : String(error));
      });
    },
    [scope]
  );
  const clear = (0, import_react.useCallback)(
    (field) => {
      setFailure(void 0);
      void scope.unset(field).catch((error) => {
        setFailure(error instanceof Error ? error.message : String(error));
      });
    },
    [scope]
  );
  if (snapshot.status === "loading") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Page, { t, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "info", children: t("loading") }) });
  if (snapshot.status === "unavailable" || snapshot.mode === "memory") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Page, { t, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "warn", children: t("unavailable") }) });
  }
  const value = snapshot.value;
  if (!value) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Page, { t, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "info", children: t("loading") }) });
  const locked = !snapshot.writable;
  const overridden = (field) => isOverridden(snapshot.user, field);
  const writeNested = (parent, patch) => write(parent, { ...value[parent], ...patch });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Page, { t, children: [
    locked ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "warn", children: t("readonly") }) : null,
    failure ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "bad", children: t("saveFailed", { reason: failure }) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Section, { title: t("connectionTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Row,
        {
          label: t("enabled"),
          hint: t("enabledHint"),
          overridden: overridden("enabled"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          onReset: () => clear("enabled"),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            Toggle,
            {
              checked: value.enabled,
              disabled: locked,
              onChange: (next) => write("enabled", next)
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TokenRow, { ref_: value.tokenRef, remote, t, locked }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Row,
        {
          label: t("tokenRef"),
          hint: t("tokenRefHint"),
          overridden: overridden("tokenRef"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          onReset: () => clear("tokenRef"),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CommittedText, { value: value.tokenRef, disabled: locked, onCommit: (next) => write("tokenRef", next) })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Row,
        {
          label: t("baseUrl"),
          hint: t("baseUrlHint"),
          overridden: overridden("baseUrl"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          onReset: () => clear("baseUrl"),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CommittedText, { value: value.baseUrl, disabled: locked, onCommit: (next) => write("baseUrl", next) })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Section, { title: t("accessTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.28))" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "warn", children: t("accessWarning") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        AllowListRow,
        {
          ids: value.allowFrom,
          locked,
          overridden: overridden("allowFrom"),
          t,
          onCommit: (ids) => write("allowFrom", ids),
          onReset: () => clear("allowFrom")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Section, { title: t("mediaTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Row,
        {
          label: t("mediaEnabled"),
          hint: t("mediaHint"),
          overridden: overridden("media"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          onReset: () => clear("media"),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            Toggle,
            {
              checked: value.media.enabled,
              disabled: locked,
              onChange: (next) => writeNested("media", { enabled: next })
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        VisionModelRow,
        {
          value: value.media.visionModel ?? "",
          remote,
          t,
          disabled: locked || !value.media.enabled,
          onChange: (next) => writeNested("media", { visionModel: next })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Section, { title: t("screenTitle"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      Row,
      {
        label: t("screenshotEnabled"),
        hint: t("screenshotHint"),
        overridden: overridden("screenshot"),
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        onReset: () => clear("screenshot"),
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          Toggle,
          {
            checked: value.screenshot.enabled,
            disabled: locked,
            onChange: (next) => writeNested("screenshot", { enabled: next })
          }
        )
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Section, { title: t("repliesTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Row,
        {
          label: t("streamingEnabled"),
          hint: t("streamingHint"),
          overridden: overridden("streaming"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          onReset: () => clear("streaming"),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            Toggle,
            {
              checked: value.streaming.enabled,
              disabled: locked,
              onChange: (next) => writeNested("streaming", { enabled: next })
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: t("throttle"), hint: t("throttleHint"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        NumberInput,
        {
          value: value.streaming.throttleMs,
          disabled: locked,
          onCommit: (next) => writeNested("streaming", { throttleMs: next })
        }
      ) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Section, { title: t("advancedTitle"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Row,
        {
          label: t("cwd"),
          hint: t("cwdHint"),
          overridden: overridden("cwd"),
          overriddenLabel: t("overridden"),
          resetLabel: t("reset"),
          onReset: () => clear("cwd"),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CommittedText, { value: value.cwd ?? "", width: 280, disabled: locked, onCommit: (next) => write("cwd", next) })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: t("longPoll"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        NumberInput,
        {
          value: value.longPollSeconds,
          min: 1,
          disabled: locked,
          onCommit: (next) => write("longPollSeconds", next)
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: t("timeout"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        NumberInput,
        {
          value: value.timeoutMs,
          min: 1e3,
          disabled: locked,
          onCommit: (next) => write("timeoutMs", next)
        }
      ) })
    ] })
  ] });
}
function Page(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { maxWidth: 720, padding: "8px 4px 40px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: { margin: "0 0 6px", fontSize: 20, color: "var(--dsw-alias-label-primary, currentColor)" }, children: props.t("heading") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: "0 0 24px", fontSize: 13, color: "var(--dsw-alias-label-secondary, #6b7280)" }, children: props.t("subheading") }),
    props.children
  ] });
}
function presentToken(state, locked) {
  if (state.kind === "checking") {
    return { hint: "tokenChecking", editable: false, retryable: false, removable: false };
  }
  if (state.kind === "unknown") {
    return {
      hint: "tokenCheckFailed",
      params: { reason: state.reason },
      editable: false,
      retryable: true,
      removable: false
    };
  }
  if (!state.writable) {
    return {
      hint: state.source === "env" ? "tokenFromEnvironment" : "tokenReadOnly",
      editable: false,
      retryable: false,
      removable: false
    };
  }
  return {
    hint: state.configured ? "tokenConfigured" : "tokenMissing",
    editable: !locked,
    retryable: false,
    removable: state.configured && !locked
  };
}
function TokenRow(props) {
  const { ref_, remote, t } = props;
  const [state, setState] = (0, import_react.useState)({ kind: "checking" });
  const [draft, setDraft] = (0, import_react.useState)("");
  const [saved, setSaved] = (0, import_react.useState)(false);
  const [failure, setFailure] = (0, import_react.useState)();
  const refresh = (0, import_react.useCallback)(() => {
    setState({ kind: "checking" });
    void remote.credentials.describe({ refs: [ref_] }).then((answer) => {
      if (!answer.result.ok) {
        return setState({ kind: "unknown", reason: answer.result.error.message });
      }
      const info = answer.result.value.credentials[ref_];
      if (!info) {
        return setState({ kind: "known", configured: false, writable: true });
      }
      setState({
        kind: "known",
        configured: info.configured,
        writable: info.writable,
        ...info.source !== void 0 ? { source: info.source } : {}
      });
    }).catch((error) => {
      setState({ kind: "unknown", reason: error instanceof Error ? error.message : String(error) });
    });
  }, [remote, ref_]);
  (0, import_react.useEffect)(refresh, [refresh]);
  const view = presentToken(state, props.locked);
  const save = () => {
    if (draft === "") return;
    setFailure(void 0);
    void remote.credentials.set({ ref: ref_, value: draft }).then((answer) => {
      if (!answer.result.ok) return setFailure(answer.result.error.message);
      setDraft("");
      setSaved(true);
      refresh();
    }).catch((error) => setFailure(error instanceof Error ? error.message : String(error)));
  };
  const remove = () => {
    setFailure(void 0);
    void remote.credentials.unset({ ref: ref_ }).then((answer) => {
      if (!answer.result.ok) return setFailure(answer.result.error.message);
      setSaved(false);
      refresh();
    }).catch((error) => setFailure(error instanceof Error ? error.message : String(error)));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: t("tokenTitle"), hint: t(view.hint, view.params), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        TextInput,
        {
          type: "password",
          value: draft,
          onChange: setDraft,
          onCommit: save,
          placeholder: t("tokenPlaceholder"),
          disabled: !view.editable
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: save, disabled: !view.editable || draft === "", children: t("tokenSave") })
    ] }),
    view.retryable ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: refresh, children: t("tokenRetry") }) : null,
    view.removable ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: remove, tone: "danger", children: t("tokenClear") }) : null,
    saved ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "good", children: t("tokenSaved") }) : null,
    failure ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Note, { tone: "bad", children: failure }) : null
  ] }) });
}
function VisionModelRow(props) {
  const { remote, t } = props;
  const [groups, setGroups] = (0, import_react.useState)();
  const [failed, setFailed] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    let stale = false;
    void remote.llm.models({}).then((answer) => {
      if (stale) return;
      if (!answer.result.ok) return setFailed(true);
      setGroups(answer.result.value.groups);
    }).catch(() => {
      if (!stale) setFailed(true);
    });
    return () => {
      stale = true;
    };
  }, [remote]);
  const options = (0, import_react.useMemo)(() => {
    const listed = [{ value: "", label: t("visionModelNone") }];
    for (const group of groups ?? []) {
      for (const model of group.models) {
        listed.push({
          value: `${group.id}/${model.id}`,
          label: model.name ?? model.id,
          group: group.name ?? group.id
        });
      }
    }
    if (props.value !== "" && !listed.some((option) => option.value === props.value)) {
      listed.push({ value: props.value, label: props.value, group: t("visionModelUnavailable") });
    }
    return listed;
  }, [groups, props.value, t]);
  const hint = failed ? t("visionModelUnreadable") : groups === void 0 ? t("visionModelLoading") : t("visionModelHint");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Row, { label: t("visionModel"), hint, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    Select,
    {
      value: props.value,
      options,
      disabled: props.disabled || groups === void 0,
      onChange: props.onChange,
      width: 260
    }
  ) });
}
function AllowListRow(props) {
  const stored = (0, import_react.useMemo)(() => props.ids.join(", "), [props.ids]);
  const [draft, setDraft] = (0, import_react.useState)(stored);
  const [invalid, setInvalid] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    setDraft(stored);
    setInvalid(false);
  }, [stored]);
  const commit = () => {
    const parsed = parseIds(draft);
    if (!parsed) return setInvalid(true);
    setInvalid(false);
    if (parsed.join(",") !== props.ids.join(",")) props.onCommit(parsed);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    Row,
    {
      label: props.t("allowFrom"),
      hint: invalid ? props.t("allowFromInvalid") : props.t("allowFromHint"),
      overridden: props.overridden,
      overriddenLabel: props.t("overridden"),
      resetLabel: props.t("reset"),
      onReset: props.onReset,
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        TextInput,
        {
          value: draft,
          onChange: setDraft,
          onCommit: commit,
          disabled: props.locked,
          invalid,
          width: 240,
          placeholder: "562660734, 12345678"
        }
      )
    }
  );
}
function CommittedText(props) {
  const [draft, setDraft] = (0, import_react.useState)(props.value);
  (0, import_react.useEffect)(() => setDraft(props.value), [props.value]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    TextInput,
    {
      value: draft,
      onChange: setDraft,
      onCommit: () => {
        if (draft !== props.value) props.onCommit(draft);
      },
      disabled: props.disabled ?? false,
      ...props.width !== void 0 ? { width: props.width } : {}
    }
  );
}
function useSettingsSnapshot(scope) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(() => scope.getSnapshot());
  (0, import_react.useEffect)(() => {
    setSnapshot(scope.getSnapshot());
    return scope.subscribe(() => setSnapshot(scope.getSnapshot()));
  }, [scope]);
  return snapshot;
}
function isOverridden(user, field) {
  if (typeof user !== "object" || user === null) return false;
  return Object.hasOwn(user, field);
}
function parseIds(text) {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  const ids = [];
  for (const part of trimmed.split(",")) {
    const id = Number(part.trim());
    if (!Number.isInteger(id) || id <= 0) return void 0;
    ids.push(id);
  }
  return ids;
}

// src/client/locale.ts
var locales = {
  en: {
    nav: "Telegram",
    heading: "Telegram",
    subheading: "Talk to the agent from Telegram, with real formatting and answerable questions.",
    loading: "Reading configuration\u2026",
    unavailable: "This browser cannot reach the settings document, so nothing here can be changed. Settings are loopback-only \u2014 open the harness on the machine running it.",
    readonly: "The settings document is read-only in this deployment.",
    connectionTitle: "Connection",
    enabled: "Connected",
    enabledHint: "Turn off to disconnect the bot without removing the plugin.",
    tokenTitle: "Bot token",
    tokenChecking: "Checking\u2026",
    tokenCheckFailed: "Could not check the stored token: {reason}",
    tokenRetry: "Check again",
    tokenReadOnly: "This credential is read-only in this deployment.",
    tokenConfigured: "A token is stored.",
    tokenMissing: "No token yet. Create a bot with @BotFather and paste its token here.",
    tokenFromEnvironment: "Supplied by the environment, so it cannot be changed here.",
    tokenPlaceholder: "Paste a bot token",
    tokenSave: "Save token",
    tokenClear: "Remove token",
    tokenSaved: "Token saved. Reconnecting.",
    tokenRef: "Credential reference",
    tokenRefHint: "Where the token is stored. Change it only to keep several bots apart.",
    baseUrl: "Bot API address",
    baseUrlHint: "Change only when routing through a proxy.",
    accessTitle: "Access",
    accessWarning: "Anyone allowed here can make the agent run commands on this machine. Leave the list empty to hand the bot to one person with the claim code printed on the console.",
    allowFrom: "Allowed Telegram user ids",
    allowFromHint: "Comma separated. Empty enables the one-time claim flow. Send /whoami to find an id.",
    allowFromInvalid: "Enter numeric user ids separated by commas.",
    mediaTitle: "Attachments",
    mediaEnabled: "Read images and text files",
    mediaHint: "Off replies that attachments are not accepted.",
    visionModel: "Model that reads images",
    visionModelHint: "Chosen from the models added in Settings \u2192 Models. It must accept images \u2014 no DeepSeek model does. An image is read in a session of its own, and only what it says joins your conversation, which therefore keeps its own model and tools.",
    visionModelNone: "Send the image to the conversation itself",
    visionModelLoading: "Reading the configured models\u2026",
    visionModelUnreadable: "Could not read the configured models. Add one in Settings \u2192 Models.",
    visionModelUnavailable: "No longer configured",
    screenTitle: "Screen",
    screenshotEnabled: "Allow /screenshot",
    screenshotHint: "Sends a picture of this machine's screen to the chat. Off by default \u2014 a screen holds whatever happens to be on it. On macOS the harness also needs Screen Recording permission.",
    repliesTitle: "Replies",
    streamingEnabled: "Stream the answer as it is written",
    streamingHint: "Off sends each reply once, when it is finished.",
    throttle: "Minimum gap between edits (ms)",
    throttleHint: "Telegram rate-limits rapid edits to one chat. Below about a second invites that.",
    advancedTitle: "Advanced",
    cwd: "Working directory for new conversations",
    cwdHint: "Empty uses the directory the harness was started in.",
    longPoll: "Long-poll seconds",
    timeout: "Request timeout (ms)",
    overridden: "changed",
    reset: "Reset",
    saveFailed: "That change was not saved: {reason}"
  },
  zh: {
    nav: "Telegram",
    heading: "Telegram",
    subheading: "\u5728 Telegram \u91CC\u4E0E Agent \u5BF9\u8BDD\uFF0C\u4FDD\u7559\u5B8C\u6574\u683C\u5F0F\uFF0C\u5E76\u53EF\u76F4\u63A5\u56DE\u7B54\u63D0\u95EE\u3002",
    loading: "\u6B63\u5728\u8BFB\u53D6\u914D\u7F6E\u2026",
    unavailable: "\u6B64\u6D4F\u89C8\u5668\u65E0\u6CD5\u8BBF\u95EE\u8BBE\u7F6E\u6587\u6863\uFF0C\u56E0\u6B64\u8FD9\u91CC\u65E0\u6CD5\u4FEE\u6539\u3002\u8BBE\u7F6E\u4EC5\u9650\u672C\u673A\u8BBF\u95EE\uFF0C\u8BF7\u5728\u8FD0\u884C harness \u7684\u673A\u5668\u4E0A\u6253\u5F00\u3002",
    readonly: "\u6B64\u90E8\u7F72\u7684\u8BBE\u7F6E\u6587\u6863\u4E3A\u53EA\u8BFB\u3002",
    connectionTitle: "\u8FDE\u63A5",
    enabled: "\u5DF2\u8FDE\u63A5",
    enabledHint: "\u5173\u95ED\u540E\u65AD\u5F00\u673A\u5668\u4EBA\u8FDE\u63A5\uFF0C\u4F46\u4E0D\u5378\u8F7D\u63D2\u4EF6\u3002",
    tokenTitle: "\u673A\u5668\u4EBA Token",
    tokenChecking: "\u6B63\u5728\u68C0\u67E5\u2026",
    tokenCheckFailed: "\u65E0\u6CD5\u68C0\u67E5\u5DF2\u4FDD\u5B58\u7684 Token\uFF1A{reason}",
    tokenRetry: "\u91CD\u65B0\u68C0\u67E5",
    tokenReadOnly: "\u6B64\u90E8\u7F72\u4E2D\u8BE5\u51ED\u636E\u4E3A\u53EA\u8BFB\u3002",
    tokenConfigured: "\u5DF2\u4FDD\u5B58 Token\u3002",
    tokenMissing: "\u5C1A\u672A\u914D\u7F6E Token\u3002\u8BF7\u7528 @BotFather \u521B\u5EFA\u673A\u5668\u4EBA\u5E76\u628A Token \u7C98\u8D34\u5230\u8FD9\u91CC\u3002",
    tokenFromEnvironment: "\u7531\u73AF\u5883\u53D8\u91CF\u63D0\u4F9B\uFF0C\u65E0\u6CD5\u5728\u6B64\u4FEE\u6539\u3002",
    tokenPlaceholder: "\u7C98\u8D34\u673A\u5668\u4EBA Token",
    tokenSave: "\u4FDD\u5B58 Token",
    tokenClear: "\u5220\u9664 Token",
    tokenSaved: "Token \u5DF2\u4FDD\u5B58\uFF0C\u6B63\u5728\u91CD\u65B0\u8FDE\u63A5\u3002",
    tokenRef: "\u51ED\u636E\u5F15\u7528\u540D",
    tokenRefHint: "Token \u7684\u5B58\u653E\u4F4D\u7F6E\u3002\u4EC5\u5728\u9700\u8981\u533A\u5206\u591A\u4E2A\u673A\u5668\u4EBA\u65F6\u4FEE\u6539\u3002",
    baseUrl: "Bot API \u5730\u5740",
    baseUrlHint: "\u4EC5\u5728\u901A\u8FC7\u4EE3\u7406\u65F6\u624D\u9700\u8981\u4FEE\u6539\u3002",
    accessTitle: "\u8BBF\u95EE\u6743\u9650",
    accessWarning: "\u8FD9\u91CC\u5141\u8BB8\u7684\u4EBA\u90FD\u80FD\u8BA9 Agent \u5728\u672C\u673A\u6267\u884C\u547D\u4EE4\u3002\u7559\u7A7A\u5219\u901A\u8FC7\u63A7\u5236\u53F0\u6253\u5370\u7684\u8BA4\u9886\u7801\u628A\u673A\u5668\u4EBA\u4EA4\u7ED9\u4E00\u4E2A\u4EBA\u3002",
    allowFrom: "\u5141\u8BB8\u7684 Telegram \u7528\u6237 ID",
    allowFromHint: "\u7528\u9017\u53F7\u5206\u9694\u3002\u7559\u7A7A\u542F\u7528\u4E00\u6B21\u6027\u8BA4\u9886\u6D41\u7A0B\u3002\u53D1\u9001 /whoami \u53EF\u67E5\u770B\u81EA\u5DF1\u7684 ID\u3002",
    allowFromInvalid: "\u8BF7\u8F93\u5165\u4EE5\u9017\u53F7\u5206\u9694\u7684\u6570\u5B57\u7528\u6237 ID\u3002",
    mediaTitle: "\u9644\u4EF6",
    mediaEnabled: "\u8BFB\u53D6\u56FE\u7247\u548C\u6587\u672C\u6587\u4EF6",
    mediaHint: "\u5173\u95ED\u540E\uFF0C\u6536\u5230\u9644\u4EF6\u65F6\u56DE\u590D\u4E0D\u63A5\u53D7\u3002",
    visionModel: "\u8D1F\u8D23\u8BFB\u53D6\u56FE\u7247\u7684\u6A21\u578B",
    visionModelHint: "\u4ECE \u8BBE\u7F6E \u2192 Models \u4E2D\u5DF2\u6DFB\u52A0\u7684\u6A21\u578B\u91CC\u9009\u62E9\u3002\u8BE5\u6A21\u578B\u5FC5\u987B\u652F\u6301\u56FE\u7247\u2014\u2014DeepSeek \u7684\u6A21\u578B\u90FD\u4E0D\u652F\u6301\u3002\u56FE\u7247\u4F1A\u5728\u4E00\u4E2A\u72EC\u7ACB\u7684\u4E34\u65F6\u4F1A\u8BDD\u4E2D\u88AB\u8BFB\u53D6\uFF0C\u53EA\u6709\u8BFB\u51FA\u7684\u6587\u5B57\u8FDB\u5165\u4F60\u7684\u5BF9\u8BDD\uFF0C\u56E0\u6B64\u5BF9\u8BDD\u672C\u8EAB\u4ECD\u4FDD\u7559\u539F\u6709\u6A21\u578B\u4E0E\u5DE5\u5177\u3002",
    visionModelNone: "\u628A\u56FE\u7247\u76F4\u63A5\u53D1\u7ED9\u5BF9\u8BDD\u672C\u8EAB",
    visionModelLoading: "\u6B63\u5728\u8BFB\u53D6\u5DF2\u914D\u7F6E\u7684\u6A21\u578B\u2026",
    visionModelUnreadable: "\u65E0\u6CD5\u8BFB\u53D6\u5DF2\u914D\u7F6E\u7684\u6A21\u578B\u3002\u8BF7\u5148\u5728 \u8BBE\u7F6E \u2192 Models \u4E2D\u6DFB\u52A0\u3002",
    visionModelUnavailable: "\u5DF2\u4E0D\u518D\u914D\u7F6E",
    screenTitle: "\u5C4F\u5E55",
    screenshotEnabled: "\u5141\u8BB8 /screenshot",
    screenshotHint: "\u628A\u672C\u673A\u5C4F\u5E55\u7684\u622A\u56FE\u53D1\u5230\u804A\u5929\u91CC\u3002\u9ED8\u8BA4\u5173\u95ED\u2014\u2014\u5C4F\u5E55\u4E0A\u6709\u4EC0\u4E48\u5C31\u4F1A\u62CD\u5230\u4EC0\u4E48\u3002\u5728 macOS \u4E0A\uFF0Charness \u8FD8\u9700\u8981\u300C\u5C4F\u5E55\u5F55\u5236\u300D\u6743\u9650\u3002",
    repliesTitle: "\u56DE\u590D",
    streamingEnabled: "\u8FB9\u751F\u6210\u8FB9\u663E\u793A\u56DE\u7B54",
    streamingHint: "\u5173\u95ED\u540E\uFF0C\u6BCF\u6761\u56DE\u590D\u5728\u5199\u5B8C\u540E\u4E00\u6B21\u6027\u53D1\u9001\u3002",
    throttle: "\u4E24\u6B21\u7F16\u8F91\u7684\u6700\u5C0F\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09",
    throttleHint: "Telegram \u5BF9\u540C\u4E00\u4F1A\u8BDD\u7684\u9891\u7E41\u7F16\u8F91\u6709\u9650\u6D41\u3002\u4F4E\u4E8E\u7EA6\u4E00\u79D2\u5BB9\u6613\u89E6\u53D1\u3002",
    advancedTitle: "\u9AD8\u7EA7",
    cwd: "\u65B0\u4F1A\u8BDD\u7684\u5DE5\u4F5C\u76EE\u5F55",
    cwdHint: "\u7559\u7A7A\u5219\u4F7F\u7528\u542F\u52A8 harness \u7684\u76EE\u5F55\u3002",
    longPoll: "\u957F\u8F6E\u8BE2\u79D2\u6570",
    timeout: "\u8BF7\u6C42\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
    overridden: "\u5DF2\u4FEE\u6539",
    reset: "\u6062\u590D\u9ED8\u8BA4",
    saveFailed: "\u672A\u80FD\u4FDD\u5B58\u8BE5\u4FEE\u6539\uFF1A{reason}"
  }
};

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var name = "@mikhail/dsh-telegram";
var inject = ["slots", "locale", "settingsScope"];
var NAMESPACE = "telegram";
var NAV_ORDER = 61;
function apply(ctx) {
  ctx.effect(() => {
    ctx.locale.register(NAMESPACE, locales);
  }, "dsh-telegram: locales");
  const translate = ctx.locale.bind(NAMESPACE);
  const scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
  const connection = ctx.get("connection");
  const Section2 = function TelegramSection() {
    if (!connection) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TelegramPanel, { scope, remote: connection.api, t: translate });
  };
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      {
        name: "settings.section",
        id: NAMESPACE,
        order: NAV_ORDER,
        label: () => translate("nav"),
        locale: NAMESPACE
      },
      Section2
    )
  );
}

    return module.exports;
  }
});
