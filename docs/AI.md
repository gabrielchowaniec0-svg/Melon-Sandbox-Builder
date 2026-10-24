# AI planning: owner guide

The Build page can turn a sentence such as "a small cart with a rocket engine and a crate on top" into a plan. It uses a small, cheap Claude model. The plan is checked against the parts list before you see it, so it can only contain parts that exist in the catalog.

## One-time setup (about five minutes)

1. Sign in at console.anthropic.com, open API keys, choose Create key, and copy it. Add a little credit under Billing (a few dollars lasts a long time).
2. In Netlify, open your site, then Site configuration > Environment variables.
3. Choose Add a variable. Name: `ANTHROPIC_API_KEY`. Value: the key you copied.
4. Open Deploys > Trigger deploy > Deploy site. Wait until it says Published.
5. Open the Build page. The AI panel should say Claude ready.

If it still says Not set up, the variable name has a typo or the deploy has not finished. The key stays inside Netlify. It is never in the web page and never in GitHub.

## How cost and limits are controlled

* Small model by default (`claude-haiku-5-5`) and at most 1500 output tokens per plan. A plan costs a fraction of a cent.
* Each plan request is limited to 600 characters.
* Site-wide limit: 200 plans a day. Each visitor: 25 plans a day. In the panel there is a 15 second pause between requests.
* When a limit is reached visitors see a plain message and can still use the quick starters or their own key.
* Also set a monthly spend limit in the Anthropic console (Settings > Limits). That is the real safety net.

## Change the settings

All are optional variables in the same Netlify screen. After any change, trigger a deploy.

| Variable | What it does | Default |
| --- | --- | --- |
| `MODEL` | Which Claude model to use. Use a bigger model for better plans, at higher cost. | `claude-haiku-5-5` |
| `MAX_DAILY_CALLS` | Plans per day for the whole site. | 200 |
| `MAX_IP_DAILY_CALLS` | Plans per day for one visitor. | 25 |
| `MAX_OUTPUT_TOKENS` | Longest answer allowed. | 1500 |
| `ALLOWED_ORIGIN` | Only needed if another website calls your helper. | empty |

To switch the AI off, delete `ANTHROPIC_API_KEY` and deploy again.

## What visitors can do without your key

* Quick starters: keyword matching against the premade plans and the parts list. No AI, no cost, works offline.
* Their own key: under Advanced they can paste an Anthropic key. It is saved only in their browser and sent only to api.anthropic.com from their device. It never touches your site's server, and your limits do not apply to it.

## Privacy

* What visitors type, and the plan they are changing, is sent to your Netlify function and then to Anthropic to get the answer. Tell visitors not to type personal information.
* The site does not store prompts or plans. It only keeps daily counters (a total, and one number per visitor using a one-way hash of the network address, not the address itself) in Netlify Blobs.
* The API key is never sent to the browser, never returned by the helper and never written to logs.

## How the plan is checked

Claude answers with a list of parts and links. The helper then drops any part that is not in the catalog (and tells the visitor), snaps positions to the 1/8 crate grid, moves overlapping parts apart, lowers floating parts so they rest on something, drops links that make no sense, and caps the plan at 60 parts and 40 links. Plans are always labelled untested.

## Problems

* "Claude refused the key": the key is wrong, revoked, or out of credit. Check it in the Anthropic console, update the variable, deploy.
* "Overloaded" or "rate limiting": wait a minute and try again.
* "Took too long": the helper stops after about 22 seconds. Try a shorter request.
