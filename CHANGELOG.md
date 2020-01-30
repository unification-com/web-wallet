# Changelog

## v0.11.0 - 31/01/2020

[PR22](https://github.com/unification-com/web-wallet/pull/22)

- Cleanup Docker
- Wallet summary - use Vuex instead of passing by props
- Vuex tx module - pass txData if available during addTx action
- Tx output - include tx memo
- Tx output - move collapsible info box to below Tx summary line
- Tx fetching - paginate fetching, and fetch newest Txs first.
- Tx fetching - limit initial on-load fetch to 10 sent/10 received to
improve load times
- Tx fetching - add "load more" button to fetch older Txs. Will fetch 10
more sent/10 more received Txs

## v0.10.1 - 30/01/2020

[PR21](https://github.com/unification-com/web-wallet/pull/21)

- Clear validator selection list on network change
- Simplified txSummary data in Vuex tx module
- Tx list output improvements

## v0.10.0 - 24/01/2020

[PR20](https://github.com/unification-com/web-wallet/pull/20)

- Update [UND-JS SDK](https://github.com/unification-com/und-js) to v1.4.0
- Vuex tx module restructure
- Fetch received Txs in addition to sent Txs
- Descending order by time for Tx list
- Fix Delegations auto-loading
- Remove unnecessary data from Vuex modules
- Tx list pagination
- Style/layout tweaks

## v0.9.3 - 23/01/2020

[PR19](https://github.com/unification-com/web-wallet/pull/19)

- Check account exists on chain before attempting to broadcast Txs
- Bug fixes & tweaks

## v0.9.1 - 21/01/2020

[PR18](https://github.com/unification-com/web-wallet/pull/18)

- Add Chrome Extension link to Help component
- Update README

## v0.9.0 - 20/01/2020

[PR17](https://github.com/unification-com/web-wallet/pull/17)

- Implement vuex for sharing client, wallet, validator, staking & 
tx data across components
- Add debug logger for vuex
- Minor tweaks & fixes

## <= v0.8.0 - Internal dev builds
