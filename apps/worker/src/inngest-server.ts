import { connect } from "inngest/connect";
import {
  checkScheduledPosts,
  inngest,
  publishScheduledPost,
  pullAnalyticsSnapshots,
  renderClip,
} from "@svt/workflow";

/**
 * Opens an outbound-only persistent connection to Inngest instead of hosting
 * an inbound HTTP endpoint — lets the worker run behind NAT/firewalls (e.g.
 * a home PC with no public IP) since Inngest never needs to reach back in.
 */
export async function startInngestConnection(): Promise<void> {
  const connection = await connect({
    apps: [
      {
        client: inngest,
        functions: [renderClip, publishScheduledPost, checkScheduledPosts, pullAnalyticsSnapshots],
      },
    ],
  });
  console.log(`[worker] Inngest connected (connection id: ${connection.connectionId})`);
}
