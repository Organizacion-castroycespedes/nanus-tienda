# Design

## Runtime transport selection

`requestPeripheral` remains the single Web entry point. It first resolves a
validated `window.manusTerminal` capability and, when present, maps only the
known peripheral paths to the corresponding typed bridge method. Unknown paths
continue to fail closed. Browser-only execution retains the existing
`NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL`/WebSocket configuration and HTTPS
validation.

The packaged Electron shell keeps `contextIsolation`, disabled
`nodeIntegration`, and sandboxing. The main process continues to call only the
fixed `http://127.0.0.1:4050` Agent origin from the versioned shell config.
No renderer-controlled base URL or generic request channel is added.

## Authenticated cloud handoff

After authentication, `LocalPeripheralSyncManager` may synchronize local
assigned roles only when tenant, branch, and a real operational terminal ID
are present. Cloud calls use the authenticated API client and the existing
`/pos-terminals/resolve-current` and `/pos-terminals/:id/peripherals` contracts.
Agent installation identity and physical device IDs remain local descriptors;
they are not treated as cloud terminal UUIDs.

## State boundaries

Agent discovery/runtime status, Agent configured device records, and cloud
terminal peripheral settings remain separate. Existing primary-printer and
printer-mediated drawer metadata are preserved. The fix changes only transport
selection and observability of the handoff.

## Failure behavior

If the Electron bridge is absent, the browser path remains subject to its
existing configuration validation and reports a controlled configuration
error. If the bridge is present but an operation is not allowlisted, the
request fails closed rather than falling through to a direct localhost fetch.
