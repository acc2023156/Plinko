# SHA-Platform integration

The browser no longer owns the authoritative balance or Plinko outcome on this integration branch.

## Local URL

Start SHA-Platform on port 3000, serve this repository on port 8080, then open:

```text
http://localhost:8080/?api=http://localhost:3000/api/v1&dev=1
```

`dev=1` allows the client to call the development wallet bootstrap route when the player has no wallet. The backend must have `ALLOW_DEV_BOOTSTRAP=true`. Never enable this route in production.

The browser keeps only a demo player identifier, client seed and UI preferences in localStorage. Balance, commitment rotation, outcome, multiplier and payout come from SHA-Platform.

Before merging this branch into the GitHub Pages deployment, configure a public HTTPS API URL through the lobby launch URL:

```text
https://acc2023156.github.io/Plinko/?api=https%3A%2F%2Fapi.example.com%2Fapi%2Fv1
```
