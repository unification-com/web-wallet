/**
 * Fetch every page of a paginated Cosmos SDK list query. The SDK caps each
 * page (100 items by default), so a single call silently drops the rest —
 * MainNet has ~180 validators, which left every validator past the first page
 * without a moniker in the staking views.
 *
 * `fetchPage` receives the previous page's `nextKey` (undefined for the first
 * page) and returns that page's items plus its pagination response.
 */
export async function collectPages<T>(
  fetchPage: (
    paginationKey?: Uint8Array,
  ) => Promise<{ items: T[]; pagination?: { nextKey?: Uint8Array | undefined } | undefined }>,
): Promise<T[]> {
  const all: T[] = []
  let key: Uint8Array | undefined
  do {
    const { items, pagination } = await fetchPage(key)
    all.push(...items)
    key = pagination?.nextKey?.length ? pagination.nextKey : undefined
  } while (key)
  return all
}
