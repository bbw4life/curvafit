const fetch = require('node-fetch');

const PRODUCTS_DATA = [
  {
    id: "resistance-bands",
    title: "Smart Hula Hoop — Waist Burner",
    description: "Burns belly fat while you watch TV. The magnetic design stays on your waist automatically — adjustable from 18 to 24 sections to fit every size.",
    price: 79.99,
    compare_price: 148.99,
    colors: ["Blue", "Purple", "Pink"],
    sizes: ["18 sections", "21 sections", "24 sections"],
    url: "/products/product1.html"
  },
  {
    id: "yoga-mat",
    title: "Plus Size Waist Trainer — S to 6XL",
    description: "High-compression waist cincher with zipper closure that supports your core during workouts. Improves posture, reduces waist size visually — from S to 6XL.",
    price: 34.99,
    compare_price: 54.99,
    colors: ["Fuchsia", "Black"],
    sizes: ["S","M","L","XL","XXL","XXXL","4XL","5XL","6XL"],
    url: "/products/product2.html"
  },
  {
    id: "leggings",
    title: "Smart Jump Rope — LCD Counter",
    description: "Count every jump automatically. Burns 200+ calories in 20 minutes — no gym needed. The LCD display tracks your daily cardio progress.",
    price: 17.99,
    compare_price: 29.99,
    colors: ["Pink", "Black", "Blue"],
    sizes: [],
    url: "/products/product3.html"
  },
  {
    id: "sports-bra",
    title: "High Waist Yoga Pants — Peach Lift",
    description: "Buttery-soft seamless pants that lift and shape your peach. High waist stays put during squats and floor exercises — 10 stunning colors from S to XL.",
    price: 16.99,
    compare_price: 28.99,
    colors: ["Army Green","Dark Blue","Wine Red","Khaki","Light Gray","Plain Black"],
    sizes: ["S","M","L","XL"],
    url: "/products/product4.html"
  },
  {
    id: "hydration-bottle",
    title: "Half-Zip Yoga Jumpsuit — Slim Fit",
    description: "All-in-one yoga jumpsuit with bare-skin feel fabric and high elasticity. Perfect for home yoga, pilates and stretching sessions.",
    price: 34.99,
    compare_price: 54.99,
    colors: ["Dark Red","Black","Navy Blue","Chestnut","White Gray"],
    sizes: ["S","M","L","XL"],
    url: "/products/product5.html"
  },
  {
    id: "workout-towel",
    title: "Seamless Tie Dye Leggings — High Waist",
    description: "Ultra-stretchy seamless leggings that sculpt your curves and stay in place. Perfect for yoga, walks, and home workouts.",
    price: 22.99,
    compare_price: 38.99,
    colors: ["Yellow","Pink","Blue","Black"],
    sizes: ["S","M","L"],
    url: "/products/product6.html"
  },
  {
    id: "fitness-tracker",
    title: "Shock-Absorbing Sports Bra — S to 5XL",
    description: "High-impact support bra built for curvy women. Wide straps, moisture-wicking fabric — from morning walks to intense home workouts.",
    price: 24.99,
    compare_price: 44.99,
    colors: ["Dream Sky Blue","Purple Verbenaceae","Brick Red","Khaki","Black"],
    sizes: ["S","M","L","XL","XXL","3XL","4XL","5XL"],
    url: "/products/product7.html"
  },
  {
    id: "protein-shaker",
    title: "Anti-Shock Knee Support Pads",
    description: "Protect your knees during home workouts, walks, and floor exercises. Anti-collision design absorbs impact and reduces joint pain.",
    price: 14.99,
    compare_price: 24.99,
    colors: ["Grey","Navy Blue","Black"],
    sizes: ["M","L","XL"],
    url: "/products/product8.html"
  },
  {
    id: "dumbbell-set",
    title: "Invisible Posture Corrector — S to XXL",
    description: "Straighten your posture effortlessly and reduce back pain. Lightweight and invisible under clothes — available from S to XXL.",
    price: 14.99,
    compare_price: 24.99,
    colors: ["Pink","Black","Nude"],
    sizes: ["S","M","L","XL","XXL"],
    url: "/products/product9.html"
  },
  {
    id: "jump-rope",
    title: "C6S Smart Bracelet — Heart Rate & Sleep",
    description: "Track heart rate, blood oxygen, steps and sleep quality in real time. Know exactly how your body responds to your workouts.",
    price: 32.99,
    compare_price: 54.99,
    colors: ["Purple","Red","Pink","White","Black","Blue"],
    sizes: [],
    url: "/products/product10.html"
  },
  {
    id: "foam-roller",
    title: "Acupressure Mat — Stress & Recovery",
    description: "Lie down 20 minutes and feel the tension dissolve. Reduces cortisol, eases sore muscles and improves your sleep after every workout.",
    price: 22.99,
    compare_price: 39.99,
    colors: ["Black","Light Green","Purple","Blue"],
    sizes: [],
    url: "/products/product11.html"
  },
  {
    id: "yoga-blocks",
    title: "Warm Belly Belt — Cramp Relief",
    description: "Gentle heat therapy for your belly and lower back. Relieves cramps, cold tension and post-workout soreness — wear it discreetly under your clothes.",
    price: 25.99,
    compare_price: 42.99,
    colors: ["Pink","White"],
    sizes: [],
    url: "/products/product12.html"
  },
  {
    id: "ankle-weights",
    title: "Sports Water Bottle 650ml — Spray Cap",
    description: "Stay hydrated and curb false hunger. This 650ml spray bottle supports metabolism and reduces cravings naturally.",
    price: 9.99,
    compare_price: 17.99,
    colors: ["Gray","Green","Orange","Pink","Blue"],
    sizes: [],
    url: "/products/product13.html"
  },
  {
    id: "cooling-towel",
    title: "Lightweight Running Shoes — EU 39-44",
    description: "Ultra-light mesh sneakers with soft soles that protect your joints. Breathable and comfortable — designed for women building their daily movement habit.",
    price: 22.99,
    compare_price: 39.99,
    colors: ["Grey","Black"],
    sizes: ["39","40","41","42","43","44"],
    url: "/products/product14.html"
  },
  {
    id: "massage-ball",
    title: "Water Cube Neck Pillow — SPA Support",
    description: "Washable water-filled pillow that contours perfectly to your neck. Relieves cervical tension after long sitting sessions and improves deep sleep.",
    price: 14.99,
    compare_price: 24.99,
    colors: ["Purple White","Yellow White","Blue White","Pink White","White"],
    sizes: ["800g","850g","900g","1000g"],
    url: "/products/product15.html"
  },
  {
    id: "gym-bag",
    title: "Wireless Sport Earbuds — Noise Cancelling",
    description: "Block distractions and stay in the zone. Noise-cancelling wireless earbuds make every walk and workout more enjoyable.",
    price: 22.99,
    compare_price: 39.99,
    colors: ["Dark Green","Rose Gold","White","Royal Blue","Black"],
    sizes: [],
    url: "/products/product16.html"
  }
];

function searchProducts(query) {
  if (!query) return [];
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/);
  
  const scored = PRODUCTS_DATA.map(p => {
    let score = 0;
    const searchText = `${p.title} ${p.description} ${p.id}`.toLowerCase();
    
    keywords.forEach(kw => {
      if (kw.length < 3) return;
      if (searchText.includes(kw)) score += 3;
      if (p.title.toLowerCase().includes(kw)) score += 2;
    });
    
    // Thematic matching
    if ((q.includes('hula') || q.includes('hoop') || q.includes('belly') || q.includes('ventre')) && p.id === 'resistance-bands') score += 10;
    if ((q.includes('waist') || q.includes('taille') || q.includes('trainer') || q.includes('gainant')) && p.id === 'yoga-mat') score += 10;
    if ((q.includes('jump') || q.includes('rope') || q.includes('corde') || q.includes('cardio')) && p.id === 'leggings') score += 10;
    if ((q.includes('legging') || q.includes('pants') || q.includes('yoga') || q.includes('pantalon')) && p.id === 'sports-bra') score += 10;
    if ((q.includes('jumpsuit') || q.includes('combinaison') || q.includes('pilates')) && p.id === 'hydration-bottle') score += 10;
    if ((q.includes('sport bra') || q.includes('bra') || q.includes('brassiere') || q.includes('soutien')) && p.id === 'fitness-tracker') score += 10;
    if ((q.includes('knee') || q.includes('genoux') || q.includes('protection')) && p.id === 'protein-shaker') score += 10;
    if ((q.includes('posture') || q.includes('dos') || q.includes('back') || q.includes('corrector')) && p.id === 'dumbbell-set') score += 10;
    if ((q.includes('bracelet') || q.includes('tracker') || q.includes('heart') || q.includes('sleep') || q.includes('sommeil')) && p.id === 'jump-rope') score += 10;
    if ((q.includes('acupressure') || q.includes('mat') || q.includes('stress') || q.includes('recovery') || q.includes('recuperation')) && p.id === 'foam-roller') score += 10;
    if ((q.includes('belly') || q.includes('cramp') || q.includes('chaleur') || q.includes('heat') || q.includes('belt')) && p.id === 'yoga-blocks') score += 10;
    if ((q.includes('bottle') || q.includes('water') || q.includes('eau') || q.includes('hydrat')) && p.id === 'ankle-weights') score += 10;
    if ((q.includes('shoe') || q.includes('chaussure') || q.includes('running') || q.includes('sneaker')) && p.id === 'cooling-towel') score += 10;
    if ((q.includes('pillow') || q.includes('oreiller') || q.includes('neck') || q.includes('cervical')) && p.id === 'massage-ball') score += 10;
    if ((q.includes('earbuds') || q.includes('headphone') || q.includes('music') || q.includes('musique') || q.includes('ecouteur')) && p.id === 'gym-bag') score += 10;
    if ((q.includes('legging') || q.includes('tie dye') || q.includes('seamless')) && p.id === 'workout-towel') score += 10;
    
    // Price range
    if ((q.includes('cheap') || q.includes('budget') || q.includes('pas cher') || q.includes('moins cher')) && p.price < 20) score += 5;
    if ((q.includes('premium') || q.includes('best') || q.includes('top') || q.includes('meilleur')) && p.price > 30) score += 3;
    
    return { ...p, score };
  });
  
  return scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { message, history = [] } = JSON.parse(event.body);
    
    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };
    }

    const relevantProducts = searchProducts(message);
    
    let productContext = '';
    if (relevantProducts.length > 0) {
      productContext = '\n\n📦 RELEVANT PRODUCTS FROM OUR CATALOG:\n';
      relevantProducts.forEach((p, i) => {
        productContext += `\n${i + 1}. **${p.title}**
   - Price: $${p.price} (was $${p.compare_price})
   - Description: ${p.description}
   - Colors: ${p.colors.join(', ') || 'One size fits all'}
   - Sizes: ${p.sizes.length > 0 ? p.sizes.join(', ') : 'No size selection needed'}
   - Product page: ${p.url}\n`;
      });
    }

    const systemPrompt = `You are Cora, the friendly and expert fitness advisor for CurvaFit — a premium fitness brand designed specifically for curvy women.

YOUR PERSONALITY:
- Warm, empowering, and body-positive
- Expert in fitness, nutrition, and wellness for plus-size women
- Enthusiastic about helping women feel confident and strong
- Conversational, not robotic

YOUR RULES:
1. ONLY recommend products from the catalog provided below. NEVER invent products or prices.
2. If no product matches, say you'll check and suggest browsing the shop.
3. Always mention the exact price from the catalog — never guess or round.
4. Respond in the SAME LANGUAGE as the user (French or English).
5. Keep responses concise (2-4 sentences max per point).
6. Use emojis naturally to make responses feel warm and human.
7. If asked about sizing, mention available sizes from the catalog.
8. Always end with a gentle call-to-action when recommending a product.
9. NEVER make up health claims beyond what's in the descriptions.
10. If asked something outside fitness/products, politely redirect.

ABOUT CURVAFIT:
- Women's fitness brand focused on curvy/plus-size women
- Products range from $9.99 to $79.99
- Free shipping on orders over $120
- 30-day money-back guarantee
- Ships to 50+ countries
${productContext}

Respond naturally and helpfully. If products are listed above, reference them specifically.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 512,
        temperature: 0.7,
        stream: false
      })
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      console.error('Groq error:', err);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const data = await groqResponse.json();
    const reply = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply,
        products: relevantProducts.slice(0, 2).map(p => ({
          title: p.title,
          price: p.price,
          compare_price: p.compare_price,
          url: p.url,
          id: p.id
        }))
      })
    };

  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};