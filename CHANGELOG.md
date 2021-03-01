# Changelog

## v0.19.2 - 01/03/2021

[PR39](https://github.com/unification-com/web-wallet/pull/39)
[PR40](https://github.com/unification-com/web-wallet/pull/40)
[PR41](https://github.com/unification-com/web-wallet/pull/41)
[PR42](https://github.com/unification-com/web-wallet/pull/42)
[PR44](https://github.com/unification-com/web-wallet/pull/44)
[PR45](https://github.com/unification-com/web-wallet/pull/45)
[PR46](https://github.com/unification-com/web-wallet/pull/46)
[PR49](https://github.com/unification-com/web-wallet/pull/49)

- Update images based on latest app name and icon
- Convert fees to FUND in confirmation dialogs
- Style tweaks & minor fixes
- Bump gas estimates
- Add Memo-Field for Redelegations & Undelegations
- Bump `und-js` version
- Filter Txs not for the user's address (caused by Cosmos SDK v0.38 event stacking bug)
- Only display active validators in Staking list
- Add node status icon and details to Delegations tab for quick reference
- Load validator set when wallet initialises
- Load bonded, unbonded and unbonding validators into set
- NPM package updates
- Fixed lodash object comparison when adding delegations to local storage
- Add toggle to hide "0 nund" delegations

## v0.18.2 - 16/07/2020

[PR35](https://github.com/unification-com/web-wallet/pull/35)
[PR36](https://github.com/unification-com/web-wallet/pull/36)

- Optimise REST queries to reduce the amount of requests sent
- Store more data in Veux, instead of continuously querying REST
- UI improvements - reposition Toast notifications, so they don't 
cover the buttons
- Strip HTML tags from Validator descriptions
- Checks to see if full balance is being sent, and prevents it 
if detected
- Checks to see if the wallet has enough balance to send Tx 
amount + fees (both transfer and staking)
- Display warning if, after sending a Tx, the wallet balance will 
be < a recommended amount required for any potential future Tx fees
- Clear delegations/unbonding/redelegation from vuex before refreshing
- Allow 9 decimal places in Txs
- Remove Enterprise tab - vast majority of users do not need it

## v0.17.2 - 26/06/2020

[PR34](https://github.com/unification-com/web-wallet/pull/34)

- Fix typo in Wallet component
- Update node dependencies

## v0.17.1 - 15/05/2020

[PR33](https://github.com/unification-com/web-wallet/pull/33)

- Fix missed FUND renames
- Remove legacy DevNet info

## v0.17.0 - 11/05/2020

[PR32](https://github.com/unification-com/web-wallet/pull/32)

- MainNet configurations
- Rename UND to FUND

## v0.16.1 - 24/04/2020

[PR31](https://github.com/unification-com/web-wallet/pull/31)

- bug fix - bootstrap vue icon name changes
- Enterprise - query chain for address's Enterprise whitelist status
- Enterprise - only display Raise PO form in address is whitelisted

## v0.15.4 - 20/04/2020

[PR30](https://github.com/unification-com/web-wallet/pull/30)

- Update default fees to match recommended `min-gas-prices` of 0.25nund
- Update npm packages

## v0.15.3 - 27/02/2020

[PR29](https://github.com/unification-com/web-wallet/pull/29)

- Fix explorer URL - check chain ID is set

## v0.15.2 - 26/02/2020

[PR28](https://github.com/unification-com/web-wallet/pull/28)

- Fix explorer URL for different TestNet versions

## v0.15.1 - 17/02/2020

[PR27](https://github.com/unification-com/web-wallet/pull/27)

- Display toast on network change
- Add WRKChain/BEACON msg types
- Prepend toasts

## v0.15.0 - 14/02/2020

[PR26](https://github.com/unification-com/web-wallet/pull/26)

- Add utility function for filtering Tx event attributes
- Custom RPC input whitespace trim
- Add support for transactions with multiple messages

## v0.14.0 - 07/02/2020

[PR25](https://github.com/unification-com/web-wallet/pull/25)

- Output Validator information when selecting an existing EV for delegation
- Links to Block Explorer for Tx hashes, addresses, Validators etc.
- Format large numbers `nnn,nnn,nnn.nnn...`

## v0.12.1 - 07/02/2020

[PR24](https://github.com/unification-com/web-wallet/pull/24)

- Update UND-JS to v1.5.1
- Better storage/handling of internal client `node_info` and `app_version` data
- Network information styling tweaks
- Ensure client is fully nullified on network connection error due to invalid REST URL

## v0.12.0 - 05/02/2020

[PR23](https://github.com/unification-com/web-wallet/pull/23)

- Update UND-JS to v1.5.0
- Allow input/connection to custom REST server
- Get and store REST server's `node_info` response in client Vuex
- Output `node_info` in popover
- Implement UND-JS error handler
- Typos

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
