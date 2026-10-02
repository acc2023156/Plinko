# SHA-Platform integration

The browser no longer owns the authoritative balance or Plinko outcome on this integration branch.

## Local URL

Start SHA-Platform on port 3000, serve this repository on port 8080, then open:

```text
http://localhost:8080/?api=http://localhost:3000/api/v1&dev=1
```

`dev=1` allows the client to call the development wallet bootstrap route when the player has no wallet. The backend must have `ALLOW_DEV_BOOTSTRAP=true`. Never enable this route in production.

The browser keeps only a demo player identifier, client seed and UI preferences in localStorage. Balance, commitment rotation, outcome, multiplier and payout come from SHA-Platform.

Production requires a short-lived launch token. Pass it in the URL fragment so it is not sent to GitHub Pages or intermediary access logs. The adapter moves it into sessionStorage and removes the fragment from the address bar:

```text
https://acc2023156.github.io/Plinko/?api=https%3A%2F%2Fapi.example.com%2Fapi%2Fv1#token=SHORT_LIVED_TOKEN
```

The `x-player-id` header is used only for `?dev=1` local integration. Never put `LAUNCH_TOKEN_SECRET` in this repository or any browser code.
