import { getListings } from "./listing";
import { getCurrentUser } from "./user";

export const getProperties = async (args?: Record<string, string | undefined>) => {
  const user = await getCurrentUser();
  if (!user) {
    return {
      listings: [],
      nextCursor: null,
    };
  }

  return getListings({
    userId: args?.userId ?? user.id,
    cursor: args?.cursor,
  });
};
