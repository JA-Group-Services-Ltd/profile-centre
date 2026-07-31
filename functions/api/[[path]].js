import { handleApiRequest } from "../_shared/router.js";

export function onRequest(context) {
  return handleApiRequest(context);
}

