// Public ownership proof for the Xperiments plugin; this is not an API credential.
const challenge = "7578HWsY2Gl1yNY5T8_1BA59N9FeJtpzFBpOOY4XFl8";

export function GET() {
  return new Response(challenge, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
