// OpenTelemetry setup: every span created with @langfuse/tracing is exported
// to Langfuse by the LangfuseSpanProcessor. Import this file first.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// Reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL.
export const otelSdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

otelSdk.start();

// Short-lived CLI: flush everything before the process exits.
// If Langfuse is down the trace is lost, but the run itself still succeeded.
export async function shutdownTracing() {
  await otelSdk.shutdown().catch((error) => {
    console.error(`(trace not sent to Langfuse: ${error instanceof Error ? error.message || error.name : error})`);
  });
}
