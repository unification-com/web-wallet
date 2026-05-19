import { StargateClient } from '@cosmjs/stargate'
import { useQuery } from '@tanstack/react-query'

export type ChainEndpoint = {
  id: 'mainnet' | 'testnet' | 'devnet'
  label: string
  rpc: string
  rest: string
}

export const ENDPOINTS: Record<ChainEndpoint['id'], ChainEndpoint> = {
  mainnet: {
    id: 'mainnet',
    label: 'MainNet',
    rpc: 'https://rpc1.unification.io:443',
    rest: 'https://rest.unification.io',
  },
  testnet: {
    id: 'testnet',
    label: 'TestNet',
    rpc: 'https://rpc-testnet.unification.io:443',
    rest: 'https://rest-testnet.unification.io',
  },
  devnet: {
    id: 'devnet',
    label: 'DevNet',
    rpc: 'http://localhost:26657',
    rest: 'http://localhost:1317',
  },
}

export type ChainInfo = {
  chainId: string
  height: number
  rpc: string
}

async function fetchChainInfo(endpoint: ChainEndpoint): Promise<ChainInfo> {
  const client = await StargateClient.connect(endpoint.rpc)
  try {
    const chainId = await client.getChainId()
    const height = await client.getHeight()
    return { chainId, height, rpc: endpoint.rpc }
  } finally {
    client.disconnect()
  }
}

export function useChainInfo(endpoint: ChainEndpoint) {
  return useQuery({
    queryKey: ['chain-info', endpoint.id],
    queryFn: () => fetchChainInfo(endpoint),
    refetchInterval: 12_000,
  })
}
