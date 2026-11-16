export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on Vercel.' });
  }

  try {
    const { mode, subject, prompt, imageBase64, lang, projType, focus, usedAngles } = req.body;

    // 1. Unique Anti-Duplicate Research & Project Idea Mode
    if (mode === 'project') {
      const systemPrompt = `You are the Study Flow Anti-Duplicate Research Architect (Owned by DistingStyle Ltd).
Your critical mission: Generate a 100% original, never-repeated academic project or research idea so two classmates asking about the same topic NEVER get similar ideas.
Already used angles to strictly AVOID: ${JSON.stringify(usedAngles || [])}.
Respond in ${lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English'}.
Return ONLY valid JSON with keys: "title", "lens", "researchQuestion", "hook", "steps" (array of 4 strings).`;

      const userMsg = `Topic: ${prompt}\nProject Type: ${projType}\nPersonal/Local Focus: ${focus || 'General'}\nRandom Unique Seed: ${Date.now()}-${Math.random()}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          temperature: 0.95,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
      const parsed = JSON.parse(data.choices[0].message.content);
      return res.status(200).json({ project: parsed });
    }

    // 2. AI Tutor Mode (Text, Image Vision, Voice TTS, or Video Storyboard)
    const langName = lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English';
    let formatInstruction = 'Provide a clear, structured, step-by-step educational explanation.';
    if (mode === 'voice') {
      formatInstruction = 'Provide a warm, spoken-style tutor explanation (around 120-160 words) suitable for audio narration, clear and easy to follow by ear.';
    } else if (mode === 'video') {
      formatInstruction = 'Provide a visual Scene-by-Scene Video Lesson Script (Scene 1: Hook, Scene 2: Core Concept Visual, Scene 3: Worked Example, Scene 4: Quick Recap) with clear visual cues.';
    }

    const userContent = [
      {
        type: 'text',
        text: `Subject: ${subject}\nLanguage: ${langName}\nInstruction: ${formatInstruction}\nStudent Question: ${prompt || 'Explain the attached lesson image step-by-step.'}`
      }
    ];

    if (imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageBase64 }
      });
    }

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        max_tokens: 750,
        messages: [
          {
            role: 'system',
            content: `You are Study Flow, an expert trilingual AI tutor (Owned by DistingStyle Ltd). Adapt to the student's level, explain clearly in ${langName}, and format nicely with clean HTML tags like <b>, <br>, and <ul>/<li> (no markdown backticks).`
          },
          { role: 'user', content: userContent }
        ]
      })
    });

    const chatData = await chatRes.json();
    if (!chatRes.ok) throw new Error(chatData.error?.message || 'OpenAI Chat error');
    const replyHtml = chatData.choices[0].message.content;

    // Generate real MP3 voice audio if mode === 'voice'
    let audioBase64 = null;
    if (mode === 'voice') {
      const plainText = replyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
      const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova',
          input: plainText
        })
      });

      if (ttsRes.ok) {
        const arrayBuffer = await ttsRes.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');
        audioBase64 = `data:audio/mp3;base64,${base64Audio}`;
      }
    }

    return res.status(200).json({ reply: replyHtml, audioBase64 });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
