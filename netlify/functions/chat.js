const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  try {
    const { message, history = [] } = JSON.parse(event.body);

    // Charger products.data.json dynamiquement
    const productsResponse = await fetch('https://curva-fit.netlify.app/products.data.json');
    const allData = await productsResponse.json();

    // Filtrer uniquement les vrais produits
    const productList = allData.filter(p => !p.type && p.id && p.title);

    // Recherche intelligente
    const query = message.toLowerCase();
    const relevantProducts = productList
      .map(p => {
        let score = 0;
        const text = `${p.title} ${p.description}`.toLowerCase();
        if (text.includes(query)) score += 10;
        if (p.title.toLowerCase().includes(query)) score += 5;
        return { ...p, score };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // Construire le contexte pour l'IA
    let productContext = '';
    if (relevantProducts.length > 0) {
      productContext = '\n\n📦 Here are the best matching products from our catalog:\n\n';
      relevantProducts.forEach((p, i) => {
        productContext += `${i+1}. **${p.title}**\n`;
        productContext += `   💰 $${p.price} (was $${p.compare_price})\n`;
        productContext += `   📝 ${p.description}\n`;
        if (p.colors && p.colors.length) productContext += `   🎨 Colors: ${p.colors.map(c => c.name).join(', ')}\n`;
        if (p.sizes && p.sizes.length) productContext += `   📏 Sizes: ${p.sizes.join(', ')}\n`;
        productContext += `   🔗 Link: ${p.url || 'shop.html'}\n\n`;
      });
    }

    const systemPrompt = `You are Curva Support, the official friendly AI assistant of CurvaFit.

You help plus-size women lose weight in a healthy, realistic and motivating way.
You are warm, empowering, and never pushy.

Rules:
- Always call yourself "Curva Support"
- Only recommend real products from the catalog below
- Never invent products, prices or links
- Respond in the same language as the user (French or English)
- Be concise and helpful
- End with a gentle call-to-action when recommending a product

${productContext}

Now answer the user's message naturally.`;

    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      { role: 'user', content: message }
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messagesPayload,
        max_tokens: 600,
        temperature: 0.75
      })
    });

    const data = await groqRes.json();
    const reply = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        reply: reply,
        products: relevantProducts.map(p => ({
          title: p.title,
          price: p.price,
          compare_price: p.compare_price,
          image: p.image,
          url: p.url || 'shop.html',
          description: p.description
        }))
      })
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ reply: "Sorry, I'm having trouble right now. Please try again!" })
    };
  }
};