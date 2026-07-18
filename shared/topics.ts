import type { SpectrumCard } from './types';

export interface DeckInfo {
  id: string;
  name: string;
  description: string;
}

export const DECKS: DeckInfo[] = [
  { id: 'classic', name: 'Classic', description: 'Everyday spectrums anyone can play' },
  { id: 'popculture', name: 'Pop Culture', description: 'Movies, music, memes and fame' },
  { id: 'opinions', name: 'Hot Takes', description: 'Opinions and judgment calls' },
  { id: 'tricky', name: 'Tricky', description: 'Abstract, debatable, mind-bending' },
  { id: 'party', name: 'Party', description: 'A little spicy — best with friends' },
];

function deck(id: string, pairs: [string, string][]): SpectrumCard[] {
  return pairs.map(([left, right], i) => ({
    id: `${id}-${String(i + 1).padStart(2, '0')}`,
    left,
    right,
    deck: id,
  }));
}

// To add a new deck: add an entry to DECKS above and a ...deck('yourid', [...]) block below.
export const PRESET_TOPICS: SpectrumCard[] = [
  ...deck('classic', [
    ['Cold', 'Hot'],
    ['Dark', 'Bright'],
    ['Quiet', 'Loud'],
    ['Tiny', 'Enormous'],
    ['Slow', 'Fast'],
    ['Soft', 'Hard'],
    ['Cheap', 'Expensive'],
    ['Common', 'Rare'],
    ['Dry', 'Wet'],
    ['Light', 'Heavy'],
    ['Smooth', 'Rough'],
    ['Short-lived', 'Long-lasting'],
    ['Fragile', 'Indestructible'],
    ['Clean', 'Dirty'],
    ['Sweet', 'Savory'],
    ['Round', 'Pointy'],
  ]),
  ...deck('popculture', [
    ['Forgotten meme', 'Immortal meme'],
    ['Indie film', 'Blockbuster'],
    ['One-hit wonder', 'Legendary artist'],
    ['Underrated movie', 'Overrated movie'],
    ['Guilty pleasure song', 'Certified classic'],
    ['Reboot material', 'Leave it alone'],
    ['Niche fandom', 'Global fandom'],
    ['Cancelled too soon', 'Ran too long'],
    ['Movie villain', 'Movie hero'],
    ['Background character', 'Main character energy'],
    ['Box office bomb', 'Box office smash'],
    ['Cringe celebrity', 'Beloved celebrity'],
    ['Sequel nobody wanted', 'Sequel everyone needed'],
    ['Fashion crime', 'Fashion icon'],
    ['Low-budget effects', 'Movie magic'],
    ['Gym playlist song', 'Rainy day song'],
  ]),
  ...deck('opinions', [
    ['Overrated pizza topping', 'Underrated pizza topping'],
    ['Worst chore', 'Best chore'],
    ['Rude', 'Polite'],
    ['Overpaid job', 'Underpaid job'],
    ['Deal-breaker', 'Endearing quirk'],
    ['Overrated holiday', 'Underrated holiday'],
    ['Trashy TV', 'Prestige TV'],
    ['Breakfast food', 'Dinner food'],
    ['Useless superpower', 'God-tier superpower'],
    ['Waste of money', 'Worth every penny'],
    ['Red flag', 'Green flag'],
    ['Mildly annoying', 'Infuriating'],
    ['Snack', 'Meal'],
    ['Bad advice', 'Good advice'],
    ['Should be illegal', 'Should be mandatory'],
    ['Ugly car', 'Beautiful car'],
  ]),
  ...deck('tricky', [
    ['Round number', 'Weird number'],
    ['Barely a sandwich', 'Definitely a sandwich'],
    ['Feels like science', 'Feels like magic'],
    ['A want', 'A need'],
    ['Vandalism', 'Art'],
    ['Game', 'Sport'],
    ['Introvert activity', 'Extrovert activity'],
    ['Concrete', 'Abstract'],
    ['Pure luck', 'Pure skill'],
    ['Job', 'Hobby'],
    ['Sounds fake', 'Sounds true'],
    ['Perfectly ethical', 'Morally questionable'],
    ['Vegetable', 'Fruit'],
    ['Grandparent name', 'Baby name'],
    ['Smells better than it tastes', 'Tastes better than it smells'],
    ['Invention we needed', 'Invention nobody asked for'],
  ]),
  ...deck('party', [
    ['First date activity', 'Fifth date activity'],
    ['Innocent text', 'Flirty text'],
    ['PG', 'Scandalous'],
    ['Tell your boss', 'Tell your best friend'],
    ['Normal to Google', 'Embarrassing to Google'],
    ['Terrible pickup line', 'Smooth pickup line'],
    ['Family-friendly party', 'Cops get called'],
    ['Easy truth', 'Brutal truth'],
    ['Cute habit', 'Relationship-ending habit'],
    ['Wholesome compliment', 'Suspicious compliment'],
    ['Fine at a wedding', 'Kicked out of the wedding'],
    ['Mild gossip', 'Explosive gossip'],
    ['First-date confession', 'Take it to the grave'],
    ['Weeknight energy', 'Friday night energy'],
    ['Reserved', 'Shameless'],
    ['Group chat safe', 'Private DM only'],
  ]),
];
