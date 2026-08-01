# Code signing Mojiworld.exe — setup guide

**Why this exists:** Windows 11 machines with **Smart App Control (SAC)** enforced
block unsigned executables with *no* user override — verified 2026-07-27 on this
very machine, which refused the unsigned `Mojiworld.exe`. Self-signed certs do
not pass. A certificate from a trusted CA does. Steam itself does not require
signing, but your players' SAC machines do, and a signature also starts your
SmartScreen reputation clock.

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
