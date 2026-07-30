Improve UX
In gallery list view:
- after scrolling down, and clicking on a picture for detail view, and the return to list, the list is not on the same spot. 
In gallery detail view.
- we can remove the Zurueck button, so only the heruterladen is at the top, clicking on the picture should bring the user back to the list view making the zureck button not needed
In the create card dialog:
When clicking veroeffentlichen a banner should overlay the region above the button. The banner should contain something to ask the user to be sensible with their commits. Something like. Please be aware that other people will see your card, so please be sensible what you post. No Sexism, Rasism, Homophobia. It should have a sensible default, but it should be possible to overwrite the default via a url parameter.


Feature extension:
I want the possibilty to lock out users if they missbehave. For that each used needs an ID. Perhaps a unique phone id can be used, or if this is not possible a uuid is created the first time the user starts kartomat and stores it like the local images. This is the first part of the feature
The second is the functionality ensure that only users that are not in the lockout list, can commit. The lockout list is stored in supabase and is queried, when the user presses the veroeffentlichen button. Only if the user is not on the lockout list they can confirm, otherwise the banner shows to the user that they are locked out because they violated the commit policy.
The last thing that we need is a admin access to kartomat. The admin access should be enabled by providing the admin parameter. When logged in as an admin, in the gallery detail view a new button is shown at the button, the button is to delete the card. This means they can delete any cards, even it's not from them. They need to confirm twice if they delete a card. When they delete a card, they are also asked if the user should be placed on the lockout list. If that's the case the card files should be moved to front-deleted dir and the created of the card is added the user list. Otherwise the card is only moved to the front-deleted dir.
When in admin mode, it should not be possible to create cards, so the button should not be shown on the home screen. But instead there should a Deleted Gallery button, it should show the cards in front-deleted in the list. When clicked on it, instead of delete should be be two buttons, one for unlock the creator if they are in the lockedout list, if not on lockout list the button should be disabled. And another to undelete the image. When an image is undelete, and the user was locked they are automatically unlocked.
I think I mentioned above that the delete/lockout button in admin should be at the button, but instead I want to have at at the tome, because for admin we don't need the herunterladen button.


To improve visibility, when in admin mode, I want the (k)artomat on the home screen chane to (k)admin. But also some other indication, so people don't accidently be in the admin mode. e.g add a red banner at the top on all screen, that e.g. shows (k)admin.

Regarding the lockout file:
I thought it might be the best to have a dedicated bucket for the lockout file, which is pulic so everyone can read out the lockout file. The admin have a dedicated user so I don't need use anon, and this is provided via url, so admins have access to write the lockout file.
