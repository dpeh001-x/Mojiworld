# Code signing Mojiworld.exe — setup guide

> **STATUS: OPTIONAL — post-launch only (decided 2026-08-01).** Steam does not
> require code signing and the build review does not check for it. Mojiworld
> ships unsigned; the CI signing step below stays dormant until the `AZURE_*`
> secrets exist. Buy the cert only if real SAC support tickets appear after
> launch — enabling it then is six secrets + one build re-run, and the signed
> depot ships as a routine update. See "Shipping unsigned" at the bottom for
> the QA and player-support workarounds used in the meantime.

**Why this exists:** Windows 11 machines with **Smart App Control (SAC)** enforced
block unsigned executables with *no* user override — verified 2026-07-27 on this
very machine, which refused the unsigned `Mojiworld.exe`. Self-signed certs do
not pass. A certificate from a trusted CA does. Steam itself does not require
signing, but SAC-enforced players' machines block unsigned exes — a narrow
slice: SAC only survives on near-factory Windows 11 installs and permanently
disables itself once the user installs much unsigned software, and the Steam
Deck / Linux depot has no SAC at all.

The CI signing step is **already wired** into `.github/workflows/steam-build.yml`.
It activates automatically once six GitHub secrets exist; until then, builds ship
unsigned exactly as before. Nothing else in the pipeline changes.

---

## Option A (recommended): Azure Trusted Signing — ~$9.99/month

Cheapest trusted-CA route, no USB token, integrates with the existing workflow.
Availability of *individual* (non-company) identity validation has been expanding
region by region — confirm it covers you at sign-up; if not, use Option B.

1. **Azure account** — portal.azure.com, any subscription (Pay-As-You-Go fine).
2. **Create a Trusted Signing account** — search "Trusted Signing Accounts" →
   Create. Pick a region (e.g. *East US*), Basic SKU (~$9.99/mo). Note the
   **account name** and the region's **endpoint URL**
   (e.g. `https://eus.codesigning.azure.net`).
3. **Identity validation** — in the account: *Identity validations* → New.
   *Individual* needs a government ID; *Organization* needs business registration.
   This is the human-gated part — approval typically hours-to-days.
4. **Certificate profile** — *Certificate profiles* → New → **Public Trust**,
   linked to the approved identity. Note the **profile name**.
5. **App registration (CI credentials)** — Microsoft Entra ID → App registrations
   → New. Then: Certificates & secrets → New client secret (note the **value**).
   Back on the Trusted Signing account: *Access control (IAM)* → Add role
   assignment → **Trusted Signing Certificate Profile Signer** → your app.
6. **GitHub secrets** — repo → Settings → Secrets and variables → Actions →
   *Secrets* (not Variables):

   | Secret | Value |
   |---|---|
   | `AZURE_TENANT_ID` | Entra ID → Overview → Tenant ID |
   | `AZURE_CLIENT_ID` | the app registration's Application (client) ID |
   | `AZURE_CLIENT_SECRET` | the client secret value from step 5 |
   | `AZURE_TS_ENDPOINT` | the region endpoint URL from step 2 |
   | `AZURE_TS_ACCOUNT` | the Trusted Signing account name |
   | `AZURE_TS_PROFILE` | the certificate profile name |

7. **Run the workflow** ("Build Steam depots"). The sign + verify steps now run;
   the verify step fails the build if the signature is not `Valid`, so a green
   run *is* the proof. Download the artifact and launch `Mojiworld.exe` on this
   SAC-enforced machine — it should now start.

> If the `azure/trusted-signing-action@v0.5.1` tag is ever outdated, bump it to
> the latest from the GitHub Marketplace — inputs have been stable.

## Option B: traditional OV certificate — ~$80–400/year

SSL.com, Sectigo, or DigiCert **OV code-signing** cert. Since 2023 the key must
live in an HSM, so pick the CA's *cloud signing* service (e.g. SSL.com eSigner)
over a USB token — tokens cannot sign from CI. Each CA documents its own CI
step; it replaces the Azure step in the workflow. OV signatures satisfy SAC the
same way; SmartScreen reputation builds with downloads (EV certs pre-seed it but
cost more and matter little for a Steam-distributed game).

## Option C: SignPath.io free OSS tier

Only if the repo becomes public open source. Not compatible with the current
private-repo plan.

---

## Signing the ROOT launcher stub too (optional, recommended)

The repo-root `Mojiworld.exe` (the little launcher compiled from
`tools/launcher/`) is blocked by SAC for the same reason — that is why
`Mojiworld.cmd` exists as the batch workaround. Once you hold a cert, sign the
stub locally and re-commit it, after which the .exe works everywhere:

```
signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 ^
  /dlib "Azure.CodeSigning.Dlib.dll" /dmdf metadata.json Mojiworld.exe
```

(Azure Trusted Signing local signing needs their signtool dlib — see
"SignTool integration" in the Trusted Signing docs; for Option B use your CA's
signtool instructions.) `Mojiworld.cmd` stays in the repo either way as the
no-cert fallback.

## What signing does NOT fix

- macOS notarization (separate Apple process — only relevant if a mac build ships).
- SmartScreen "unrecognized app" on *non-SAC* machines during the first days —
  reputation accrues; Steam players never see it since Steam launches the exe.

---

## Shipping unsigned (the current plan) — workarounds

**Dev QA on this SAC-enforced machine.** The depot `Mojiworld.exe` will not
launch here. Test instead via:

- **Gameplay QA:** the browser build (`Mojiworld.cmd` → local server). The
  depot boot test (`scripts/steam_depot_boot_test.mjs`) proves the packaged
  content is byte-for-byte what the browser serves, so gameplay parity holds.
- **Wrapper QA** (overlay, Steam Cloud, Steam Input, quit flow): the
  **Linux/Deck depot** on real Deck hardware (no SAC on Linux), or any second
  Windows PC — practically all non-factory-fresh machines have SAC off.
  The integration suite (`scripts/steam_integration_test.mjs`, 49 checks)
  covers the same surfaces headlessly.
- Turning SAC off on this machine would also work but is **permanent** (it
  cannot be re-enabled without reinstalling Windows) — the owner's call, not
  a step this guide recommends.

**Player support note** (paste into the Steam discussions/support page if a
SAC report ever comes in — this is expected to be rare):

> If Windows says the game "was blocked because it isn't signed" or Smart App
> Control prevented it from running: Smart App Control is a Windows 11 mode
> active on some new PCs that blocks apps without a paid certificate,
> including many indie games. You can allow the game by turning it off in
> **Windows Security → App & browser control → Smart App Control settings →
> Off** (Windows makes this permanent by design). Alternatively play on Steam
> Deck/Linux, or wait for a signed build if enough players report this.

**Trigger for revisiting:** buy the cert (Option A above) when SAC tickets
actually appear, or before any distribution OUTSIDE Steam (itch/standalone
downloads hit SmartScreen's mark-of-the-web, where a signature matters much
more).
