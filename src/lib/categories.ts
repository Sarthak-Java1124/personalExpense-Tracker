export const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Fuel",
  "Shopping",
  "Bills & Utilities",
  "Rent & Housing",
  "Entertainment",
  "Health & Fitness",
  "Education",
  "Travel",
  "Personal Care",
  "Gifts & Donations",
  "Subscriptions",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Keyword rules for the offline parser. Order matters: the first category whose
 * keyword matches wins, so more specific categories come before generic ones
 * (e.g. "Subscriptions" before "Entertainment" so "netflix" isn't a movie).
 */
export const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ["Subscriptions", ["netflix", "spotify", "prime", "hotstar", "youtube premium", "subscription", "icloud", "chatgpt", "claude", "membership"]],
  ["Fuel", ["petrol", "diesel", "fuel", "gas station", "cng", "ev charging"]],
  ["Rent & Housing", ["rent", "maintenance", "society", "housing", "pg ", "hostel", "landlord", "plumber", "electrician", "repair"]],
  ["Bills & Utilities", ["electricity", "electric bill", "water bill", "wifi", "wi-fi", "internet", "broadband", "recharge", "mobile bill", "phone bill", "gas bill", "cylinder", "bill", "dth", "emi", "insurance"]],
  ["Groceries", ["grocery", "groceries", "vegetable", "vegetables", "veggies", "fruits", "fruit", "milk", "bread", "eggs", "rice", "atta", "dal", "supermarket", "kirana", "blinkit", "zepto", "bigbasket", "instamart", "dmart", "apple", "banana", "mango", "orange", "grapes", "onion", "potato", "tomato", "paneer", "curd", "butter", "oil", "sugar", "salt", "flour", "chicken", "mutton", "fish", "meat"]],
  ["Food & Dining", ["lunch", "dinner", "breakfast", "brunch", "snack", "snacks", "coffee", "tea", "chai", "food", "restaurant", "cafe", "café", "pizza", "burger", "biryani", "zomato", "swiggy", "dominos", "mcdonald", "kfc", "starbucks", "drinks", "beer", "juice", "ice cream", "dessert", "sweets", "momos", "dosa", "samosa", "maggi", "popcorn", "chips", "biscuits", "chocolate", "canteen", "mess", "meal", "eat", "ate"]],
  ["Transport", ["uber", "ola", "rapido", "auto", "rickshaw", "cab", "taxi", "metro", "bus", "train ticket", "local train", "parking", "toll", "commute", "ride"]],
  ["Travel", ["flight", "hotel", "airbnb", "trip", "vacation", "holiday", "train", "irctc", "booking", "luggage", "visa"]],
  ["Health & Fitness", ["medicine", "medicines", "pharmacy", "chemist", "doctor", "hospital", "clinic", "dentist", "gym", "yoga", "protein", "supplement", "lab test", "checkup", "health"]],
  ["Personal Care", ["haircut", "salon", "barber", "spa", "parlour", "parlor", "grooming", "shampoo", "skincare", "cosmetics", "laundry", "dry clean"]],
  ["Education", ["book", "books", "course", "tuition", "fees", "fee", "school", "college", "exam", "udemy", "coursera", "stationery", "notebook", "class"]],
  ["Entertainment", ["movie", "movies", "cinema", "pvr", "inox", "concert", "game", "games", "gaming", "party", "club", "bowling", "show", "event", "tickets"]],
  ["Gifts & Donations", ["gift", "gifts", "donation", "donate", "charity", "temple", "church", "mosque", "gurudwara", "birthday present", "present for"]],
  ["Shopping", ["shopping", "clothes", "shirt", "tshirt", "t-shirt", "jeans", "shoes", "dress", "amazon", "flipkart", "myntra", "ajio", "mall", "electronics", "laptop", "headphones", "earphones", "phone case", "watch", "bag", "furniture", "decor"]],
];

export function categorize(text: string): Category {
  const haystack = ` ${text.toLowerCase()} `;
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      // Word-boundary match so "ate" doesn't hit "late" and "bus" doesn't hit "business".
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z])${escaped}(s|es)?([^a-z]|$)`).test(haystack)) return category;
    }
  }
  return "Other";
}
