import type { EvalCase } from './metrics';

/**
 * Golden set spanning the four behaviours that matter:
 *   - answerable (general)        → must answer + cite
 *   - version-pinned (v1 / v2)    → must answer in the right version
 *   - protocol-spec              → must answer + cite the spec
 *   - out-of-scope               → must refuse
 * Questions are drawn from real SDK usage and the known v1↔v2 differences.
 */
export const GOLDEN: EvalCase[] = [
  // answerable — general
  { id: 'tool-register', question: 'How do I register a tool on an MCP server?', expect: 'answer' },
  { id: 'prompts', question: 'How do I define a prompt on an MCP server?', expect: 'answer' },
  { id: 'resources', question: 'How do I expose a resource from an MCP server?', expect: 'answer' },
  { id: 'client-connect', question: 'How do I connect an MCP client to a server?', expect: 'answer' },

  { id: 'transport-overview', question: 'What transports can an MCP server use?', expect: 'answer' },

  // version-pinned
  { id: 'v2-streamable', question: 'In v2, how do I set up the Streamable HTTP transport?', expect: 'answer', version: 'v2' },
  { id: 'v2-register', question: 'In v2, how do I register a tool with registerTool?', expect: 'answer', version: 'v2' },
  { id: 'v2-packages', question: 'In v2, which packages do I install for an MCP server?', expect: 'answer', version: 'v2' },
  { id: 'v1-tool', question: 'In v1, how do I use server.tool() to add a tool?', expect: 'answer', version: 'v1' },
  { id: 'v1-sse', question: 'In v1, how do I set up the SSE transport?', expect: 'answer', version: 'v1' },

  // protocol-spec
  { id: 'spec-auth', question: 'What does the MCP protocol specify about authorization?', expect: 'answer' },
  { id: 'spec-lifecycle', question: 'What does the protocol say about the connection lifecycle?', expect: 'answer' },
  { id: 'spec-jsonrpc', question: 'What message format does the MCP protocol use on the wire?', expect: 'answer' },

  // out-of-scope → must refuse
  { id: 'refuse-k8s', question: 'How do I deploy a Kubernetes cluster on AWS?', expect: 'refuse' },
  { id: 'refuse-pytorch', question: 'How do I train a neural network in PyTorch?', expect: 'refuse' },
  { id: 'refuse-weather', question: 'What is the weather in Tokyo today?', expect: 'refuse' },
  { id: 'refuse-python-sdk', question: 'How do I build an MCP server with the Python SDK?', expect: 'refuse' },
  { id: 'refuse-stripe', question: 'How do I add Stripe billing to my SaaS app?', expect: 'refuse' },
];
