# Benchmark — vs. Context7 & DeepWiki

This assistant is not competing on raw recall. Context7 and DeepWiki already index
the MCP TypeScript SDK and will happily answer almost anything. The differentiator
is **discipline**: answering for the *right SDK version*, *refusing* when the docs
don't cover something, and *citing* the exact source. This doc compares on those
axes.

## Why this isn't fully automated

Context7 and DeepWiki have no stable, version-pinned public API to script a fair
head-to-head against — results shift as they re-index, and neither exposes a
"which version is this" signal to assert on. Automating it would produce brittle,
non-reproducible numbers. So the comparison below is **hand-run and qualitative**,
on a fixed date, with the exact prompts recorded so anyone can repeat it. The
*self*-scorecard (this repo's pass rate) is the automated part — see
[REPORT.md](./REPORT.md) and `pnpm eval`.

## Axes

| Axis | What it means | Why generic doc bots miss it |
| --- | --- | --- |
| **Version-correctness** | Distinguishes v1 (`server.tool()`, SSE) from v2 (`registerTool()`, Streamable HTTP, split packages) | They index one blob of "the docs" and don't model the v1↔v2 split, so they mix APIs |
| **Refusal** | Says "the docs don't cover this" for out-of-scope questions | They're built to always answer; they'll improvise from general knowledge |
| **Citation** | Every claim links to the exact `blob/<ref>/…` source | They summarize; source attribution is inconsistent or absent |

## This assistant — measured

From [REPORT.md](./REPORT.md) (`pnpm eval`, 2026-06-16, 18 cases):

| Axis | Score |
| --- | --- |
| Overall pass | 18/18 (100%) |
| Refusal accuracy | 5/5 (100%) |
| Answer + citation | 13/13 (100%) |
| Version-correctness | 5/5 (100%) |

> Honest framing: 100% is against this repo's own curated golden set, which is
> designed to probe the three disciplines — it measures that the system holds its
> contract on representative questions, not that it is omniscient. Expanding the
> set is how regressions get caught; the number is a guardrail, not a trophy.

## Probe queries (repeat these by hand)

Run each against this assistant, Context7, and DeepWiki. Score 1 point per axis.

| # | Query | What a version-aware, refusing, citing answer looks like |
| --- | --- | --- |
| 1 | "How do I register a tool on an MCP server?" | Gives **both** `server.tool()` **[v1]** and `registerTool()` **[v2]**, labeled, each cited. Version-blind bots tend to give only one, unlabeled. |
| 2 | "In v2, how do I set up the Streamable HTTP transport?" | **v2-only** answer, no SSE bleed-through, cited to the v2 package docs. |
| 3 | "In v1, how do I use server.tool()?" | **v1-only**, does not suggest `registerTool()`. |
| 4 | "How do I deploy my MCP server on Kubernetes on AWS?" | **Refuses** — out of scope. Generic bots improvise a deployment guide. |
| 5 | "How do I build an MCP server with the Python SDK?" | **Refuses** — this corpus is the *TypeScript* SDK. Generic bots answer for Python. |
| 6 | "What does the protocol specify about authorization?" | Answers from the **spec** corpus (`2025-11-25`), cited. |

## Scoring template

| Query | This assistant | Context7 | DeepWiki |
| --- | --- | --- | --- |
| 1 register tool (v1+v2) | ✓ both, cited | _record_ | _record_ |
| 2 v2 Streamable HTTP | ✓ v2-only | _record_ | _record_ |
| 3 v1 server.tool | ✓ v1-only | _record_ | _record_ |
| 4 refuse k8s | ✓ refused | _record_ | _record_ |
| 5 refuse Python SDK | ✓ refused | _record_ | _record_ |
| 6 spec authorization | ✓ spec, cited | _record_ | _record_ |

Fill the right-hand columns when running the comparison live. The expectation —
and the design thesis — is that the gap shows up on **#2, #3 (version isolation)**
and **#4, #5 (refusal)**, exactly where an index-everything-answer-anything bot has
no mechanism to hold the line.
