# Pocket Phone 0.9.9 — SillyTavern compatibility mirror

This repository fixes the upstream extension's stale version metadata. The upstream code identifies itself as **Pocket Phone 0.9.9**, but its `manifest.json` still declares **0.9.6**, causing SillyTavern to display and treat it as the older build.

## Install in SillyTavern

Open **Extensions → Install Extension**, then paste:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

After installation, reload SillyTavern. The Extensions panel should show **Pocket Phone 0.9.9**.

## Implementation

The local manifest is version `0.9.9`. The JavaScript and stylesheet are loaded from the exact upstream snapshot at commit:

```text
f22ed2fcced366031b6f88271db921ebcf007d32
```

Upstream source:

```text
https://github.com/janzanaja188-cyber/pocket-phone
```

The commit is pinned, so this mirror will not silently change when upstream `main` changes. An internet connection is required when SillyTavern loads the extension because the pinned files are delivered through jsDelivr.
