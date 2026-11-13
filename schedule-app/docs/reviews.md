# FT-SCHEDULE-001 review record

Base commit: 25c30fbb743aedcad0bd5b29e76d99838fc4dcd7. Task isolated in schedule-app/.

Designer (independent agent): D1 supplied month/calendar/agenda interactions, cream/sage design, CRUD dialogs, filters, responsive accessibility and storage recovery. Personal storage confirmed by user.

Architecture review 1: REVISION_REQUIRED. Initial storage read failure must not permit a retry to overwrite unread records. D2/I2 locks mutations until validated read or explicit reset confirmation. Retry count 1/6.

Architecture review 2: APPROVED. Reviewed design.md SHA256 6C271F0CF95F12EFBF46F7890F03A72F260C8B71D0112A2B648CF8FDE0E1507E. Independent reviewer verified initial read/corrupt locks, read-only retry and explicit reset, distinct from post-load write retry. No remaining architecture findings.

Code review: APPROVED C1. Independent reviewer inspected all dist files and README against R1–R5, traced calendar/CRUD/filter/storage/modal boundaries, and ran JS syntax plus model assertions for leap dates, month generation, combined filters, read-error lock/read-only retry/recovery, retained session on write failure and duplicate-ID rejection. No blocking findings. Browser behavior remains assigned to tester.

Approved C1 SHA256:

```text
app.js     496FD8C0FDF8BC1EDA8105D50ADCD2C1AEB35437939CE949B12F12631A201A9F
index.html ED0B364A75DCAB7C3AC96101A5DE702E86BF324CC1778FC126EC197029D00DB7
model.js   A292FD8CB7CE49245222E078B4085ABF559AB742A6D847442065F362D5CC5467
styles.css 85BD2DCAEC4712BEB13C117E71D04CD4D9395F37E374D53FE8DD456811475525
README.md  FA6F6617B41382E7C67B257C549972281EFDD67BAC9F00351DE01618413CD13F
```

Tester T1: 73/73 PASS on actual Chrome156 using CDP anonymous pipes and the documented direct-file entry point (HTTP sockets denied). Evidence: test-evidence-C1-T1.md and tests/results-C1-T1.json. Product unchanged.

Independent test review T1: TEST_DEFECT. R1 date selection was only observed after form save, which independently updates selected date; calendar date-button handler was not exercised. Approval requires clicking another date and verifying selected state/date heading/agenda, then clicking back and verifying saved agenda returns. Other reviewed coverage adequate, all hashes matched, no confirmed product defect. Returned to tester for T2, retry count 2/6. Prior T1 evidence preserved.

Tester T2: 77/77 PASS. Added four actual calendar-button assertions for selected state, date heading, empty agenda and restored saved agenda. Current evidence: test-evidence-C1-T2.md, tests/results-C1-T2.json and tests/T2/ screenshots. C1 unchanged. T1 numeric evidence retained; original screenshots were regenerated from the same C1 before separate preservation and this limit is disclosed in evidence.

Independent test review T2: APPROVED. R1 coverage gap resolved; all 77 checks passed and current product/test/immutable result hashes match executed inputs. No blocking findings or required direct-file checks remain skipped. Final T2 evidence sufficient. Architect final comparison confirmed all four product hashes and test hash equal T2 executed inputs; all 77 recorded verdicts PASS. Final product status: PASS C1/T2. Hosting remains environment-blocked and unverified. No product defects remain; retry count 2/6.

## Hosting environment

Sites created a private project. The hosting configuration stays in the local checkout. The source helper initialized an isolated staging repository but failed contacting its assigned remote with `getaddrinfo() thread failed to start`. The run did not save or deploy a hosted version. Browser-local application behavior was verified separately.
