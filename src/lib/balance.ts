import { StargateClient } from '@cosmjs/stargate'
import { useQuery } from '@tanstack/react-query'

import { useActiveEndpoint } from './chain'

export interface BalanceResult {
  denom: string
  amount: string // raw chain-side amount (nund for the default Unification denom)
}

async function fetchBalance(
  rpc: string,
  address: string,
  denom: string,
): Promise<BalanceResult> {
  const client = await StargateClient.connect(rpc)
  try {
    const coin = await client.getBalance(address, denom)
    return { denom: coin.denom, amount: coin.amount }
  } finally {
    client.disconnect()
  }
}

/**
 * Live balance query for `address` in `denom` (default `nund`). Refetches
 * every 12 s while mounted. Disabled when `address` is null/empty.
 */
export function useBalance(address: string | null, denom = 'nund') {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['balance', endpoint.id, address, denom],
    queryFn: async () => {
      if (!address) throw new Error('no address')
      return await fetchBalance(endpoint.rpc, address, denom)
    },
    enabled: !!address,
    refetchInterval: 12_000,
  })
}
