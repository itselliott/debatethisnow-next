/**
 * Stock topic catalog. Sourced by the /topics browse tab, the
 * /matchmaking topic picker, the dashboard "trending" panel (random
 * subset weighted toward variety), and the random-topic fallback for
 * matchmaking. Replaces the earlier 10-item TRENDING_TOPICS list.
 *
 * Mix is intentional — every category has a serious lane and a
 * playful lane so the platform feels like "1v1 debate about
 * anything" rather than "1v1 debate about politics". The reviewer
 * tests that explicitly: pick three random topics from the catalog
 * and at least one should make a debate-club judge laugh before they
 * answer.
 *
 * If you add a category here, also add it to KNOWN_CATEGORIES below
 * so the /topics page can list it in the filter dropdown even when
 * the server-side topic count is zero.
 */

export interface CatalogTopic {
  topic: string;
  category: string;
  /** Optional tags for richer search. Lowercase, single words. */
  tags?: ReadonlyArray<string>;
}

/* eslint-disable max-len */
export const TOPIC_CATALOG: ReadonlyArray<CatalogTopic> = [
  // ----- Everyday Debates ---------------------------------------------------
  // The "is a hot dog a sandwich" lane. Low-stakes, high-engagement —
  // these are the topics that pull non-debate-nerds into a match.
  { topic: "Cereal is a soup", category: "Everyday", tags: ["food", "classification"] },
  { topic: "A hot dog is a sandwich", category: "Everyday", tags: ["food", "classification"] },
  { topic: "Pineapple belongs on pizza", category: "Everyday", tags: ["food"] },
  { topic: "Water is wet", category: "Everyday", tags: ["definition"] },
  { topic: "A tomato is a vegetable", category: "Everyday", tags: ["food", "classification"] },
  { topic: "Toilet paper should hang over the roll, not under", category: "Everyday" },
  { topic: "Breakfast is the most important meal of the day", category: "Everyday" },
  { topic: "Pizza is best eaten with your hands, not a fork", category: "Everyday" },
  { topic: "TEXTING IN ALL CAPS COUNTS AS SHOUTING", category: "Everyday" },
  { topic: "Sleeping with socks on is better", category: "Everyday" },
  { topic: "The toilet seat's default position is down", category: "Everyday" },
  { topic: "Participation trophies are bad for kids", category: "Everyday" },
  { topic: "Procrastination can be productive", category: "Everyday" },
  { topic: "Cargo shorts are unjustly maligned", category: "Everyday" },
  { topic: "The middle seat armrest belongs to the middle seat", category: "Everyday" },
  { topic: "Eating in bed is acceptable", category: "Everyday" },
  { topic: "You should always reply-all when CC'd on an email", category: "Everyday" },
  { topic: "Putting milk in before cereal is wrong", category: "Everyday" },
  { topic: "It's rude to schedule a meeting without an agenda", category: "Everyday" },
  { topic: "Voice memos are a worse form of communication than text", category: "Everyday" },
  { topic: "Tipping culture in the US has gone too far", category: "Everyday" },
  { topic: "Putting your seat back on a short flight is anti-social", category: "Everyday" },
  { topic: "It's acceptable to clip your nails on public transit", category: "Everyday" },

  // ----- Food & Drink -------------------------------------------------------
  { topic: "Coffee is overrated compared to tea", category: "Food", tags: ["drink"] },
  { topic: "Brunch is the best meal of the week", category: "Food" },
  { topic: "Ketchup belongs in the fridge", category: "Food" },
  { topic: "Bread is better fresh than toasted", category: "Food" },
  { topic: "Sushi is overrated", category: "Food" },
  { topic: "A toasted sandwich is always better than a cold one", category: "Food" },
  { topic: "Salad can be a full meal", category: "Food" },
  { topic: "Dessert should sometimes come first", category: "Food" },
  { topic: "Coke is better than Pepsi", category: "Food", tags: ["drink"] },
  { topic: "Wine snobbery is mostly performance", category: "Food", tags: ["drink"] },
  { topic: "Microwaving leftover pizza is acceptable", category: "Food" },
  { topic: "Plant-based meat alternatives will dominate within a decade", category: "Food" },
  { topic: "Tap water is better than bottled in most US cities", category: "Food", tags: ["drink"] },
  { topic: "There is no good reason to eat raisins", category: "Food" },
  { topic: "Fine dining is mostly theater", category: "Food" },
  { topic: "Chain restaurants serve a real purpose", category: "Food" },
  { topic: "Cooking shows have made home cooking worse, not better", category: "Food" },
  { topic: "Cilantro is delicious; if you taste soap that's a you problem", category: "Food" },
  { topic: "A taco is a sandwich", category: "Food", tags: ["classification"] },
  { topic: "Spicy food is overrated as a flex", category: "Food" },

  // ----- Pop Culture --------------------------------------------------------
  { topic: "Reboots are killing original cinema", category: "Pop Culture", tags: ["movies"] },
  { topic: "Reality TV is bad for society", category: "Pop Culture", tags: ["tv"] },
  { topic: "Streaming has ruined the moviegoing experience", category: "Pop Culture", tags: ["movies"] },
  { topic: "Awards shows are no longer culturally relevant", category: "Pop Culture" },
  { topic: "Celebrities should stay out of politics", category: "Pop Culture" },
  { topic: "Binge releases are better than weekly episode drops", category: "Pop Culture", tags: ["tv"] },
  { topic: "Influencer is a real job", category: "Pop Culture" },
  { topic: "Stan culture has gone too far", category: "Pop Culture" },
  { topic: "Modern pop music is creatively bankrupt", category: "Pop Culture", tags: ["music"] },
  { topic: "Vinyl is better than streaming for music appreciation", category: "Pop Culture", tags: ["music"] },
  { topic: "Cancel culture is a moral panic invented by the powerful", category: "Pop Culture" },
  { topic: "Movie remakes should require permission from the original creators", category: "Pop Culture", tags: ["movies"] },
  { topic: "Concerts are too expensive to be a healthy art form", category: "Pop Culture", tags: ["music"] },
  { topic: "Memes are the dominant art form of our era", category: "Pop Culture" },
  { topic: "Star Wars peaked with the original trilogy", category: "Pop Culture", tags: ["movies"] },
  { topic: "Anime is better storytelling than Western animation", category: "Pop Culture", tags: ["tv"] },

  // ----- Entertainment ------------------------------------------------------
  { topic: "Video games are art", category: "Entertainment", tags: ["games"] },
  { topic: "Esports deserve Olympic recognition", category: "Entertainment", tags: ["games", "sports"] },
  { topic: "The book is always better than the movie", category: "Entertainment", tags: ["books", "movies"] },
  { topic: "Audiobooks are reading", category: "Entertainment", tags: ["books"] },
  { topic: "Theater is more impactful than film", category: "Entertainment" },
  { topic: "Standup comedy has gotten worse in the last decade", category: "Entertainment" },
  { topic: "Podcasts have replaced radio for substantive discussion", category: "Entertainment" },
  { topic: "Live-action remakes of animated films should stop", category: "Entertainment", tags: ["movies"] },
  { topic: "Open-world games are usually padded and shallow", category: "Entertainment", tags: ["games"] },
  { topic: "Marvel fatigue is a real cultural shift", category: "Entertainment", tags: ["movies"] },
  { topic: "Free-to-play monetization has corrupted game design", category: "Entertainment", tags: ["games"] },
  { topic: "Three-hour movies are almost always too long", category: "Entertainment", tags: ["movies"] },
  { topic: "Subtitles should always be on", category: "Entertainment" },
  { topic: "Documentaries are more important than fiction films", category: "Entertainment", tags: ["movies"] },
  { topic: "Reading a physical book beats reading on a screen", category: "Entertainment", tags: ["books"] },

  // ----- Sports -------------------------------------------------------------
  { topic: "The designated hitter ruined baseball", category: "Sports", tags: ["baseball"] },
  { topic: "Soccer is better than American football", category: "Sports", tags: ["football", "soccer"] },
  { topic: "The NBA regular season doesn't matter anymore", category: "Sports", tags: ["basketball"] },
  { topic: "College athletes should be paid as employees", category: "Sports" },
  { topic: "Boxing is dead; MMA replaced it", category: "Sports" },
  { topic: "Salary caps make leagues better", category: "Sports" },
  { topic: "Replay review has ruined live sports", category: "Sports" },
  { topic: "Golf is not a sport", category: "Sports" },
  { topic: "Chess is a sport", category: "Sports" },
  { topic: "The GOAT in any sport is whoever played most recently", category: "Sports" },
  { topic: "Olympic sports should drop anything that's judged subjectively", category: "Sports" },
  { topic: "Fans should be able to vote on MVP awards", category: "Sports" },
  { topic: "Tanking should be punished, not strategized around", category: "Sports" },
  { topic: "Hockey deserves a bigger US audience than it gets", category: "Sports", tags: ["hockey"] },
  { topic: "The Super Bowl halftime show is more important than the game", category: "Sports", tags: ["football"] },

  // ----- Technology ---------------------------------------------------------
  { topic: "AI should be regulated like nuclear technology", category: "Technology", tags: ["ai"] },
  { topic: "Privacy is dead in the digital age", category: "Technology" },
  { topic: "Self-driving cars will be safer than humans within ten years", category: "Technology", tags: ["ai"] },
  { topic: "Cryptocurrency is a net negative for society", category: "Technology", tags: ["crypto"] },
  { topic: "AI-generated art should not be copyrightable", category: "Technology", tags: ["ai"] },
  { topic: "Open-source software has won", category: "Technology" },
  { topic: "Smartphones have made the average person less capable", category: "Technology" },
  { topic: "Programmers will mostly be replaced by AI by 2035", category: "Technology", tags: ["ai", "jobs"] },
  { topic: "Tech companies should be broken up like the railroads were", category: "Technology" },
  { topic: "Right-to-repair should be a legal requirement", category: "Technology" },
  { topic: "Section 230 should be reformed", category: "Technology" },
  { topic: "Quantum computing will not meaningfully affect daily life", category: "Technology" },
  { topic: "Blockchain has very few good real-world applications", category: "Technology", tags: ["crypto"] },
  { topic: "Smart home devices are not worth the privacy cost", category: "Technology" },
  { topic: "AI girlfriends and boyfriends are bad for humans", category: "Technology", tags: ["ai"] },
  { topic: "Email is obsolete and should be replaced", category: "Technology" },
  { topic: "The metaverse was always going to fail", category: "Technology" },
  { topic: "Phones should not be allowed in K–12 classrooms", category: "Technology", tags: ["education"] },

  // ----- Internet & Social Media --------------------------------------------
  { topic: "Social media has done more harm than good", category: "Internet" },
  { topic: "Anonymous comment sections should be banned", category: "Internet" },
  { topic: "Algorithmic feeds are worse than chronological ones", category: "Internet" },
  { topic: "Twitter was better before verification existed", category: "Internet" },
  { topic: "Reddit's quality has steadily declined since 2015", category: "Internet" },
  { topic: "TikTok is worse for teenagers than Instagram was", category: "Internet" },
  { topic: "Wikipedia is more reliable than most news outlets", category: "Internet" },
  { topic: "The early internet was better than today's internet", category: "Internet" },
  { topic: "Online dating has changed relationships for the worse", category: "Internet" },
  { topic: "Streamers have replaced traditional celebrities for under-25s", category: "Internet" },
  { topic: "Real-name policies make platforms healthier", category: "Internet" },
  { topic: "Email newsletters are the last good content format", category: "Internet" },
  { topic: "Group chats have replaced friendship", category: "Internet" },
  { topic: "Doomscrolling is a public health issue", category: "Internet" },

  // ----- Science ------------------------------------------------------------
  { topic: "Genetic engineering of humans is ethical", category: "Science", tags: ["ethics"] },
  { topic: "Humans should colonize Mars", category: "Science", tags: ["space"] },
  { topic: "Nuclear power is the only realistic path to decarbonization", category: "Science", tags: ["energy"] },
  { topic: "Animal testing should be phased out", category: "Science", tags: ["ethics"] },
  { topic: "We should not try to make contact with alien civilizations", category: "Science", tags: ["space"] },
  { topic: "Climate engineering is a necessary stopgap", category: "Science" },
  { topic: "Funding basic research is better than funding applied research", category: "Science" },
  { topic: "Peer review is broken and should be replaced", category: "Science" },
  { topic: "Lab-grown meat will be standard within 20 years", category: "Science", tags: ["food"] },
  { topic: "Mandatory vaccination policies are justified", category: "Science", tags: ["health"] },
  { topic: "We should genetically rescue endangered species", category: "Science" },
  { topic: "AGI will be developed within this century", category: "Science", tags: ["ai"] },
  { topic: "Privatized space exploration is a net positive", category: "Science", tags: ["space"] },
  { topic: "Daylight saving time should be abolished", category: "Science" },

  // ----- Philosophy ---------------------------------------------------------
  { topic: "Free will is an illusion", category: "Philosophy" },
  { topic: "We are living in a simulation", category: "Philosophy" },
  { topic: "Consciousness can exist without a biological substrate", category: "Philosophy" },
  { topic: "Morality is objective", category: "Philosophy", tags: ["ethics"] },
  { topic: "Death gives life meaning", category: "Philosophy" },
  { topic: "Suffering is necessary for growth", category: "Philosophy" },
  { topic: "Happiness is a worthier goal than meaning", category: "Philosophy" },
  { topic: "Personal identity persists through total memory loss", category: "Philosophy" },
  { topic: "We owe future generations more than past generations owed us", category: "Philosophy" },
  { topic: "The trolley problem is a useful ethical framework", category: "Philosophy", tags: ["ethics"] },
  { topic: "Stoicism is the most useful philosophy for modern life", category: "Philosophy" },
  { topic: "Religion provides social goods that secular institutions can't replicate", category: "Philosophy" },
  { topic: "The pursuit of truth is more valuable than the pursuit of happiness", category: "Philosophy" },
  { topic: "Beauty is more than just preference", category: "Philosophy" },

  // ----- Ethics -------------------------------------------------------------
  { topic: "Lab-grown meat is the ethically correct choice", category: "Ethics", tags: ["food"] },
  { topic: "Eating meat is morally wrong", category: "Ethics", tags: ["food"] },
  { topic: "Zoos are unethical even when well-run", category: "Ethics" },
  { topic: "Whistleblowers should be granted full legal immunity", category: "Ethics" },
  { topic: "We should not own pets", category: "Ethics" },
  { topic: "The death penalty is never justified", category: "Ethics" },
  { topic: "Effective altruism is the most rational form of charity", category: "Ethics" },
  { topic: "Lying to children about Santa is harmful", category: "Ethics" },
  { topic: "Doctors should be allowed to assist in dying", category: "Ethics", tags: ["health"] },
  { topic: "Reparations for historical injustice are owed today", category: "Ethics", tags: ["history"] },
  { topic: "Open borders are more ethical than closed ones", category: "Ethics", tags: ["politics"] },
  { topic: "Donating a kidney to a stranger is a moral obligation", category: "Ethics" },
  { topic: "We have no moral duty to vote", category: "Ethics", tags: ["politics"] },
  { topic: "It is unethical to bring a child into a warming world", category: "Ethics" },

  // ----- Politics -----------------------------------------------------------
  { topic: "Voting should be mandatory", category: "Politics" },
  { topic: "Democracy is the worst form of government — except all the others", category: "Politics" },
  { topic: "Term limits should apply to Congress", category: "Politics" },
  { topic: "The electoral college should be abolished", category: "Politics" },
  { topic: "Ranked-choice voting should replace plurality voting", category: "Politics" },
  { topic: "Lowering the voting age to 16 is a good idea", category: "Politics" },
  { topic: "Lobbying should be tightly restricted", category: "Politics" },
  { topic: "A unicameral legislature would be more efficient than two chambers", category: "Politics" },
  { topic: "Foreign aid is in our self-interest", category: "Politics" },
  { topic: "Mandatory national service would strengthen civic life", category: "Politics" },
  { topic: "Political parties do more harm than good", category: "Politics" },
  { topic: "Citizens' assemblies should make more decisions than elected officials", category: "Politics" },
  { topic: "Compulsory politeness laws online violate free expression", category: "Politics", tags: ["internet"] },

  // ----- Economics ----------------------------------------------------------
  { topic: "Universal basic income is inevitable", category: "Economics" },
  { topic: "Capitalism has outlived its usefulness", category: "Economics" },
  { topic: "A four-day workweek would improve productivity", category: "Economics", tags: ["work"] },
  { topic: "Inheritance should be heavily taxed", category: "Economics" },
  { topic: "Rent control creates more housing problems than it solves", category: "Economics" },
  { topic: "Minimum wage should be tied to local cost of living", category: "Economics" },
  { topic: "Student loan forgiveness is regressive", category: "Economics", tags: ["education"] },
  { topic: "Subsidies to legacy industries should end", category: "Economics" },
  { topic: "GDP is a poor measure of national success", category: "Economics" },
  { topic: "Corporations should be required to share profits with employees", category: "Economics", tags: ["work"] },
  { topic: "Carbon taxes are better policy than emissions caps", category: "Economics" },
  { topic: "Globalization has been a net good for the world", category: "Economics" },

  // ----- Work & Money -------------------------------------------------------
  { topic: "Remote work is better for everyone", category: "Work" },
  { topic: "Return-to-office mandates are a power move, not a productivity move", category: "Work" },
  { topic: "Open offices are a productivity disaster", category: "Work" },
  { topic: "Salary transparency should be required by law", category: "Work" },
  { topic: "Unpaid internships should be illegal", category: "Work" },
  { topic: "Side hustles are usually a worse use of time than rest", category: "Work" },
  { topic: "The American work week is too long compared to peer nations", category: "Work" },
  { topic: "Retirement at 65 is an outdated milestone", category: "Work" },
  { topic: "Renting is often financially smarter than buying", category: "Work", tags: ["money"] },
  { topic: "Index funds are the only investment strategy most people need", category: "Work", tags: ["money"] },
  { topic: "Credit scores should be abolished", category: "Work", tags: ["money"] },
  { topic: "Tipping should be replaced with higher wages", category: "Work" },
  { topic: "Career-changing every 3–4 years is the smarter strategy", category: "Work" },
  { topic: "MBA programs are mostly networking; the education is secondary", category: "Work", tags: ["education"] },

  // ----- Education ----------------------------------------------------------
  { topic: "College is no longer worth the price for most students", category: "Education" },
  { topic: "Standardized testing should be eliminated", category: "Education" },
  { topic: "Homework should be banned in elementary school", category: "Education" },
  { topic: "Teachers should be paid like engineers", category: "Education" },
  { topic: "Trade schools are undervalued compared to four-year colleges", category: "Education" },
  { topic: "Cursive writing should still be taught", category: "Education" },
  { topic: "A second language should be required from kindergarten", category: "Education" },
  { topic: "Letter grades should be replaced with narrative evaluations", category: "Education" },
  { topic: "School should start later in the day for teenagers", category: "Education" },
  { topic: "Gym class should count as much as math", category: "Education" },
  { topic: "Coding should be a required subject", category: "Education" },
  { topic: "Online degrees should be treated equal to in-person degrees", category: "Education" },
  { topic: "Universal preschool would have higher returns than universal college", category: "Education" },
  { topic: "School uniforms reduce inequality more than they restrict expression", category: "Education" },

  // ----- Health & Wellness --------------------------------------------------
  { topic: "Healthcare should be a constitutional right", category: "Health" },
  { topic: "Sugar should be regulated like tobacco", category: "Health", tags: ["food"] },
  { topic: "Therapy should be free and universal", category: "Health" },
  { topic: "Vaping is materially less harmful than smoking", category: "Health" },
  { topic: "Cardio is more important than strength training for longevity", category: "Health" },
  { topic: "Eight glasses of water a day is a myth", category: "Health" },
  { topic: "Mental health days should be normalized at work", category: "Health", tags: ["work"] },
  { topic: "Wearables make people healthier", category: "Health", tags: ["technology"] },
  { topic: "Caffeine should be classified as a drug", category: "Health" },
  { topic: "Cosmetic surgery should be regulated more strictly", category: "Health" },
  { topic: "Recreational drug use should be decriminalized across the board", category: "Health" },
  { topic: "Walking is the most underrated exercise", category: "Health" },
  { topic: "Diets fail because they're cultural, not biological", category: "Health" },
  { topic: "Sleep tracking apps cause more anxiety than they solve", category: "Health", tags: ["technology"] },

  // ----- Relationships ------------------------------------------------------
  { topic: "Couples should keep separate finances", category: "Relationships", tags: ["money"] },
  { topic: "Long-distance relationships are worth it", category: "Relationships" },
  { topic: "Age-gap relationships are usually a red flag", category: "Relationships" },
  { topic: "Couples therapy should be normalized from day one", category: "Relationships" },
  { topic: "Opposite-sex friendship is fully compatible with a committed relationship", category: "Relationships" },
  { topic: "Splitting the check 50/50 is the only fair way to do dinner with friends", category: "Relationships", tags: ["money"] },
  { topic: "Marriage is an outdated institution", category: "Relationships" },
  { topic: "Living together before marriage is mandatory", category: "Relationships" },
  { topic: "Friendships should be ended when they stop being mutual", category: "Relationships" },
  { topic: "Telling small lies to spare feelings is fine", category: "Relationships" },
  { topic: "Letting your kid quit things they don't like is good parenting", category: "Relationships" },
  { topic: "Honesty matters more than kindness in close relationships", category: "Relationships" },
  { topic: "Falling out of love is not a good reason to leave a marriage", category: "Relationships" },
  { topic: "Best friends should always be honest about your partner", category: "Relationships" },

  // ----- Society ------------------------------------------------------------
  { topic: "Cities are more livable than suburbs", category: "Society" },
  { topic: "Cars should be banned from city centers", category: "Society" },
  { topic: "Public transit is the single best urban investment", category: "Society" },
  { topic: "Single-family zoning should be abolished in major cities", category: "Society" },
  { topic: "Tipping is a social ill, not a kindness", category: "Society" },
  { topic: "Religion should have no role in public schools", category: "Society", tags: ["education"] },
  { topic: "Free public Wi-Fi should be a basic utility", category: "Society", tags: ["internet"] },
  { topic: "Cash should be obsolete within 20 years", category: "Society", tags: ["money"] },
  { topic: "Suburbs were a mistake", category: "Society" },
  { topic: "Public libraries are the most important civic institution", category: "Society" },
  { topic: "Greeting strangers in public is good civic glue", category: "Society" },
  { topic: "It takes a village should be policy, not just a phrase", category: "Society" },
  { topic: "Local journalism is more important than national news", category: "Society" },

  // ----- Culture ------------------------------------------------------------
  { topic: "Art belongs in public spaces, free of charge", category: "Culture" },
  { topic: "Museums should return all colonial-era artifacts", category: "Culture", tags: ["history"] },
  { topic: "Modern architecture has made cities uglier", category: "Culture" },
  { topic: "Literary fiction is overrated compared to genre fiction", category: "Culture", tags: ["books"] },
  { topic: "Hollywood is no longer the dominant culture exporter", category: "Culture" },
  { topic: "K-pop has had a bigger global impact than US pop", category: "Culture", tags: ["music"] },
  { topic: "Folk traditions are worth preserving even when impractical", category: "Culture" },
  { topic: "Translation always loses something essential", category: "Culture" },
  { topic: "Language purism does more harm than good", category: "Culture" },
  { topic: "Subcultures are stronger now than they were 20 years ago", category: "Culture" },
  { topic: "Holidays should be reduced to one per quarter", category: "Culture" },

  // ----- History -----------------------------------------------------------
  { topic: "The Industrial Revolution did more harm than good in the long run", category: "History" },
  { topic: "Napoleon was a net positive for Europe", category: "History" },
  { topic: "The fall of Rome was avoidable", category: "History" },
  { topic: "The space race was worth its cost", category: "History", tags: ["science"] },
  { topic: "Hindsight overstates the inevitability of historical events", category: "History" },
  { topic: "Public statues of historical figures should be reviewed every 50 years", category: "History" },
  { topic: "The internet is a bigger historical pivot than the printing press", category: "History", tags: ["technology"] },
  { topic: "World War II ended the era of conventional total war", category: "History" },
  { topic: "The Cold War never really ended", category: "History" },
  { topic: "Capitalism's worst excesses came from its winners, not its losers", category: "History", tags: ["economics"] },

  // ----- Lifestyle ----------------------------------------------------------
  { topic: "Owning fewer things makes people happier", category: "Lifestyle" },
  { topic: "Pets are a moral obligation in cities, not an entitlement", category: "Lifestyle" },
  { topic: "Travel is overrated as a personal growth tool", category: "Lifestyle" },
  { topic: "Houseplants are worth the work", category: "Lifestyle" },
  { topic: "Tattoos still carry meaningful professional cost", category: "Lifestyle" },
  { topic: "Hobbies should never be monetized", category: "Lifestyle" },
  { topic: "Gardening is the best post-50 hobby", category: "Lifestyle" },
  { topic: "Camping is the best vacation format", category: "Lifestyle" },
  { topic: "Reading 50 books a year is better than reading 5 deeply", category: "Lifestyle", tags: ["books"] },
  { topic: "Keeping a journal is the single highest-ROI habit", category: "Lifestyle" },
  { topic: "Owning a car in a city is a luxury, not a need", category: "Lifestyle" },
  { topic: "Buying a house is the dominant American mistake", category: "Lifestyle", tags: ["money"] },
  { topic: "Apartment living is underrated long-term", category: "Lifestyle" },
  { topic: "Voluntarily disconnecting from the internet for a week is necessary self-care", category: "Lifestyle", tags: ["internet"] },
];
/* eslint-enable max-len */

/**
 * Known category names + the canonical display order. The /topics
 * filter dropdown reads this so categories appear in a predictable
 * order even when the underlying topic count varies (e.g. user-
 * contributed history topics may briefly drop to zero between
 * deletions).
 */
export const KNOWN_CATEGORIES: ReadonlyArray<string> = [
  "Everyday",
  "Food",
  "Pop Culture",
  "Entertainment",
  "Sports",
  "Technology",
  "Internet",
  "Science",
  "Philosophy",
  "Ethics",
  "Politics",
  "Economics",
  "Work",
  "Education",
  "Health",
  "Relationships",
  "Society",
  "Culture",
  "History",
  "Lifestyle",
];

/**
 * Quick lookup — { category → topics in that category }. Built once
 * on module load.
 */
export const TOPICS_BY_CATEGORY: ReadonlyMap<string, ReadonlyArray<CatalogTopic>> =
  (() => {
    const m = new Map<string, CatalogTopic[]>();
    for (const t of TOPIC_CATALOG) {
      const arr = m.get(t.category) ?? [];
      arr.push(t);
      m.set(t.category, arr);
    }
    return m;
  })();

/**
 * Tokenize a search query into lowercased terms so the search code
 * can scan topic + tags. Whitespace + simple punctuation are
 * treated as separators.
 */
export function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,.!?;:"()[\]{}]+/u)
    .filter((t) => t.length >= 2);
}

/**
 * Substring + tag search over the catalog. Returns matches in a
 * stable order so the page can paginate. Match logic:
 *   - empty query → all topics
 *   - non-empty   → every query token must hit the topic text OR
 *                   one of the tags (case-insensitive)
 * `category` (when set) restricts results.
 */
export function searchCatalog(
  q: string,
  category?: string | null,
): CatalogTopic[] {
  const tokens = tokenizeQuery(q);
  const cat = category && category.length > 0 ? category : null;
  const out: CatalogTopic[] = [];
  for (const t of TOPIC_CATALOG) {
    if (cat && t.category !== cat) continue;
    if (tokens.length === 0) {
      out.push(t);
      continue;
    }
    const hay = (t.topic + " " + (t.tags ?? []).join(" ")).toLowerCase();
    let allMatch = true;
    for (const tok of tokens) {
      if (!hay.includes(tok)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) out.push(t);
  }
  return out;
}

/**
 * Trending-weighted random topic. Mixes Everyday and serious lanes
 * so the dashboard "trending" panel doesn't end up showing five
 * Politics topics in a row.
 */
export function trendingFromCatalog(
  limit: number,
  seed?: number,
): CatalogTopic[] {
  // Mulberry32 PRNG so callers can pin a seed (e.g. daily rotation
  // by date). Falls back to Math.random when no seed is provided.
  const rand =
    typeof seed === "number"
      ? (() => {
          let s = seed >>> 0;
          return () => {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        })()
      : Math.random;

  // Bucket by category, then round-robin to avoid same-category
  // clusters dominating the small "trending" panel.
  const buckets = new Map<string, CatalogTopic[]>();
  for (const t of TOPIC_CATALOG) {
    const b = buckets.get(t.category) ?? [];
    b.push(t);
    buckets.set(t.category, b);
  }
  for (const b of buckets.values()) {
    // Fisher-Yates within each bucket so we don't always pick the same item.
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j]!, b[i]!];
    }
  }
  const categories = [...buckets.keys()];
  for (let i = categories.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [categories[i], categories[j]] = [categories[j]!, categories[i]!];
  }
  const out: CatalogTopic[] = [];
  const idx = new Map<string, number>();
  while (out.length < limit) {
    let added = false;
    for (const c of categories) {
      if (out.length >= limit) break;
      const i = idx.get(c) ?? 0;
      const bucket = buckets.get(c)!;
      if (i < bucket.length) {
        out.push(bucket[i]!);
        idx.set(c, i + 1);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}
