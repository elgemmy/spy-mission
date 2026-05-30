# My Curated Spec

## Why this?

There's multiple instances of the game out there, none of them delivers a good UI/UX for the end user - especially in Arabic. So I'm documenting the main pain points and main goals to achieve my own version of the game. 

## Main pain points to avoid - own experience

- Sessions do not persist well, rooms get destroyed mid-game
- UI is glitchy and not enabling someone to navigate hints, cards, and game settings
- Players are kicked out of the game unexpectedly and cannot join again if closed the session
- Cards look too tight so they're uncomfortable visually 
- Too much Glass UI so it feels awkward and uncomfortable
- UI glitches when choosing buttons real-time: other people joining the open room doesn't show until the page refereshed, the user presses join team and it's not working until the page refereshed, .. etc. 
- Poor game control available for the players: player cannot switch between an operator and spymaster roles easily from inside the the team - should switch tweams then click "join as a spymaster" or so
- weird behavior in the screen when opening a keyboard to type a hint

## How the game should be - rough description

- Mobile-first smooth experience - PWA essentially
- Landing page that looks appealing - with two buttons available:
    - Create a new room
        - requires the host to choose a username - not necessarily unique
    - Join a room
        - requires the host to choose a username - not necessarily unique
- No authentication required
- Rooms are public by default - anyone with the link/code can join
- A player cannot join a private room, even with the code/link
- A player joining the room through the link/code for the first time is required to choose a username
- A host can change room settings:
    - Can choose the language of the room - English/Arabic
    - Can change the visibility settings for the room (private/public)
    - Can start the game
    - Can delete the room
    - Can move the host to other player from the same room
    - Can invite players (copy the room's link to the clipboard)
    - Can remove players from the room
- All players (including the host) can:
    - if not assigned to a team yet:
        - choose to join any team (red/blue) as operator/spymaster in one click
    - if assigned to a team:
        - switch teams in the same role as his current role in one click
        - switch roles in the same team in one click
- When the game has started:
    - The cards appear empty at first (flipped) and then show flipping sequentially to show the words on them
        - spymasters see each card's color
        - operators see all cards neutral
    - A team is selected randomly to start with a guess, and they have 9 cards to guess - the other team has 8
    - The spymaster has an two input fields and a button that allow him to: enter a text, select menu to choose the number of guesses or unlimited, submit button to post the clue to the other players
- When the clue is submitted:
    - all players (operators and spymasters) see the text hovering and animated in the middle of the screen and then it vanishes and appears in the team's log under the game
    - each operator of the same team has a "end turn" button that can be used after giving at least one guess to give the turn to the other team
    - Can click on the card to vote on it, can click differently (or double click - not sure) to select it as a final decision
- When a card is clicked:
    - it's revealed (flipped to the other side with the animation) to show the real color of the card
    - if the card is the same color as the team:
        - it reduces the remaining guesses for them by one
        - if it's not the last card for the team:
            - if there's more guesses allowed:
                - they continue giving guesses
            - otherwise:
                - their turn is over, and the turn goes to the other team
        - otherwise:
            - it ends the game and shows that team won the game
    - if the card is the color of the other team:
        - it reduces the remaining guesses for the other team by one
        - if it's not the last card for the other team:
            - it ends the turn for the team and moves the turn to the other team
        - otherwise:
            - it ends the game and shows the other team won the game
    - if the card's color is neither and safe:
        - just ends the turn and gives the control to the other team
    - if the card is the black (death) card:
        - it ends the game and shows the other team won the game directly
- When the game is over:
    - all players are directed to the room's lobby and are allowed to re-organize and choose teams normally
    - the host is allowed to edit the settings for the room normally
    - the host can start another game

- Additional mid-game options:
    - Host can re-generate cards if needed with everything as is (same teams, same roles, same room, ...etc)
    - Host can return to the room's lobby so the team can reorganize itself again and choose teams/roles