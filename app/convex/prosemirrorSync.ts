import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";

import { components } from "./_generated/api";

const prosemirrorSync = new ProsemirrorSync(
  components.prosemirrorSync as unknown as ConstructorParameters<
    typeof ProsemirrorSync
  >[0],
);

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({
  async checkRead() {
    return;
  },
  async checkWrite() {
    return;
  },
});
