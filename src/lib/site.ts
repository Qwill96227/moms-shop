// One place to rename the store or change shipping rules.
export const site = {
  name: process.env.NEXT_PUBLIC_STORE_NAME || "Mom's",
  tagline: "Tees, mugs, bottles and little things, made one at a time.",
  description:
    "Custom T-shirts, mugs, water bottles and accessories, pressed and packed by hand.",
  maker: {
    // Swap in her own words and photo (put the photo in /public/maker.jpg).
    heading: "Hi, I'm the mom in Mom's.",
    story: [
      "I started making shirts for family reunions and birthday parties, and people kept asking where they could get one. So here we are.",
      "Every order is pressed, checked and packed by me at my own table. If something isn't right, tell me and I'll make it right.",
    ],
    photo: "/maker.svg",
  },
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
  shipping: {
    flatCents: Number(process.env.NEXT_PUBLIC_SHIPPING_FLAT_CENTS ?? 595),
    freeOverCents: Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_OVER_CENTS ?? 5000),
    countries: ["US"] as const,
  },
  lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD ?? 3),
};
