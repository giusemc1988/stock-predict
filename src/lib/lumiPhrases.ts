/**
 * Lumi's offline phrasebook: common travel sentences, hand-written in 7 languages, so a tap shows
 * (and speaks) the sentence with no network and no AI call. Data-driven: add a phrase or a language
 * here and the page picks it up. Pure data + one helper, no browser APIs.
 */

export type LumiLang = 'en' | 'es' | 'fr' | 'ja' | 'ko' | 'zh' | 'th'

/** `speech` is the BCP-47 tag for the browser's speechSynthesis / SpeechRecognition. */
export const LUMI_LANGS: { code: LumiLang; name: string; speech: string }[] = [
  { code: 'en', name: 'English', speech: 'en-US' },
  { code: 'es', name: 'Español', speech: 'es-ES' },
  { code: 'fr', name: 'Français', speech: 'fr-FR' },
  { code: 'ja', name: '日本語', speech: 'ja-JP' },
  { code: 'ko', name: '한국어', speech: 'ko-KR' },
  { code: 'zh', name: '中文', speech: 'zh-CN' },
  { code: 'th', name: 'ไทย', speech: 'th-TH' },
]

export type PhraseCat = 'eat' | 'way' | 'shop' | 'help'

export const PHRASE_CATS: { id: PhraseCat; vi: string; en: string }[] = [
  { id: 'eat', vi: 'Ăn uống', en: 'Food' },
  { id: 'way', vi: 'Đi lại', en: 'Getting around' },
  { id: 'shop', vi: 'Mua sắm', en: 'Shopping' },
  { id: 'help', vi: 'Cần giúp', en: 'Help' },
]

export interface Phrase {
  id: string
  cat: PhraseCat
  vi: string
  t: Record<LumiLang, string>
}

export const PHRASES: Phrase[] = [
  { id: 'menu', cat: 'eat', vi: 'Cho tôi xem thực đơn.', t: { en: 'Could I see the menu, please?', es: '¿Me trae la carta, por favor?', fr: "Je voudrais voir la carte, s'il vous plaît.", ja: 'メニューを見せてください。', ko: '메뉴판 좀 보여 주세요.', zh: '请给我看一下菜单。', th: 'ขอดูเมนูหน่อยครับ' } },
  { id: 'recommend', cat: 'eat', vi: 'Quán có món nào ngon nhất?', t: { en: 'What do you recommend?', es: '¿Qué me recomienda?', fr: "Qu'est-ce que vous me conseillez ?", ja: 'おすすめは何ですか？', ko: '추천 메뉴가 뭐예요?', zh: '你们有什么推荐的？', th: 'มีอะไรแนะนำบ้างครับ' } },
  { id: 'allergy', cat: 'eat', vi: 'Tôi bị dị ứng. Món này có đậu phộng/hải sản không?', t: { en: "I have an allergy. Does this contain peanuts or seafood?", es: 'Soy alérgico. ¿Esto lleva cacahuetes o mariscos?', fr: "J'ai une allergie. Est-ce que ça contient des cacahuètes ou des fruits de mer ?", ja: 'アレルギーがあります。ピーナッツや海鮮は入っていますか？', ko: '알레르기가 있어요. 땅콩이나 해산물이 들어가나요?', zh: '我有过敏。这个里面有花生或海鲜吗？', th: 'ผมแพ้อาหาร อันนี้มีถั่วหรืออาหารทะเลไหมครับ' } },
  { id: 'water', cat: 'eat', vi: 'Cho tôi một ly nước.', t: { en: 'A glass of water, please.', es: 'Un vaso de agua, por favor.', fr: "Un verre d'eau, s'il vous plaît.", ja: 'お水をください。', ko: '물 한 잔 주세요.', zh: '请给我一杯水。', th: 'ขอน้ำเปล่าหนึ่งแก้วครับ' } },
  { id: 'bill', cat: 'eat', vi: 'Tính tiền giúp tôi.', t: { en: 'The bill, please.', es: 'La cuenta, por favor.', fr: "L'addition, s'il vous plaît.", ja: 'お会計をお願いします。', ko: '계산해 주세요.', zh: '请买单。', th: 'เช็คบิลด้วยครับ' } },
  { id: 'where', cat: 'way', vi: '... ở đâu vậy?', t: { en: 'Where is ...?', es: '¿Dónde está ...?', fr: 'Où est ... ?', ja: '...はどこですか？', ko: '...이(가) 어디예요?', zh: '...在哪里？', th: '...อยู่ที่ไหนครับ' } },
  { id: 'station', cat: 'way', vi: 'Ga tàu/trạm xe buýt gần nhất ở đâu?', t: { en: 'Where is the nearest station or bus stop?', es: '¿Dónde está la estación o parada de autobús más cercana?', fr: "Où est la gare ou l'arrêt de bus le plus proche ?", ja: '一番近い駅かバス停はどこですか？', ko: '가장 가까운 역이나 버스 정류장이 어디예요?', zh: '最近的车站或公交站在哪里？', th: 'สถานีหรือป้ายรถเมล์ที่ใกล้ที่สุดอยู่ที่ไหนครับ' } },
  { id: 'taxi', cat: 'way', vi: 'Cho tôi đến địa chỉ này, bật đồng hồ giúp tôi.', t: { en: 'Please take me to this address, and use the meter.', es: 'Lléveme a esta dirección, por favor, con el taxímetro.', fr: "Emmenez-moi à cette adresse, avec le compteur, s'il vous plaît.", ja: 'この住所までお願いします。メーターを使ってください。', ko: '이 주소로 가 주세요. 미터기 켜 주세요.', zh: '请带我去这个地址，请打表。', th: 'ไปที่อยู่นี้ครับ ช่วยเปิดมิเตอร์ด้วย' } },
  { id: 'howmuch', cat: 'shop', vi: 'Cái này giá bao nhiêu?', t: { en: 'How much is this?', es: '¿Cuánto cuesta esto?', fr: 'Combien ça coûte ?', ja: 'これはいくらですか？', ko: '이거 얼마예요?', zh: '这个多少钱？', th: 'อันนี้ราคาเท่าไหร่ครับ' } },
  { id: 'cheaper', cat: 'shop', vi: 'Có thể giảm giá một chút không?', t: { en: 'Is there a discount?', es: '¿Me puede hacer un descuento?', fr: 'Vous pouvez faire un geste sur le prix ?', ja: '少し安くなりませんか？', ko: '좀 깎아 주실 수 있나요?', zh: '可以便宜一点吗？', th: 'ลดราคาได้ไหมครับ' } },
  { id: 'card', cat: 'shop', vi: 'Tôi có thể trả bằng thẻ không?', t: { en: 'Can I pay by card?', es: '¿Puedo pagar con tarjeta?', fr: 'Je peux payer par carte ?', ja: 'カードで払えますか？', ko: '카드로 계산해도 되나요?', zh: '可以刷卡吗？', th: 'จ่ายด้วยบัตรได้ไหมครับ' } },
  { id: 'english', cat: 'help', vi: 'Bạn có nói được tiếng Anh không?', t: { en: 'Do you speak English?', es: '¿Habla inglés?', fr: 'Parlez-vous anglais ?', ja: '英語は話せますか？', ko: '영어 하실 수 있어요?', zh: '你会说英语吗？', th: 'พูดภาษาอังกฤษได้ไหมครับ' } },
  { id: 'slow', cat: 'help', vi: 'Xin nói chậm lại một chút.', t: { en: 'Could you speak more slowly, please?', es: '¿Podría hablar más despacio, por favor?', fr: "Pourriez-vous parler plus lentement, s'il vous plaît ?", ja: 'もう少しゆっくり話してください。', ko: '조금만 천천히 말해 주세요.', zh: '请说慢一点。', th: 'ช่วยพูดช้าลงหน่อยได้ไหมครับ' } },
  { id: 'doctor', cat: 'help', vi: 'Tôi cần gặp bác sĩ. Bệnh viện gần nhất ở đâu?', t: { en: 'I need a doctor. Where is the nearest hospital?', es: 'Necesito un médico. ¿Dónde está el hospital más cercano?', fr: "J'ai besoin d'un médecin. Où est l'hôpital le plus proche ?", ja: '医者が必要です。一番近い病院はどこですか？', ko: '의사가 필요해요. 가장 가까운 병원이 어디예요?', zh: '我需要看医生。最近的医院在哪里？', th: 'ผมต้องการพบแพทย์ โรงพยาบาลที่ใกล้ที่สุดอยู่ที่ไหนครับ' } },
  { id: 'lost', cat: 'help', vi: 'Tôi bị lạc. Bạn giúp tôi được không?', t: { en: "I'm lost. Can you help me?", es: 'Estoy perdido. ¿Puede ayudarme?', fr: 'Je suis perdu. Pouvez-vous m’aider ?', ja: '道に迷いました。助けてもらえますか？', ko: '길을 잃었어요. 도와주실 수 있나요?', zh: '我迷路了。你能帮帮我吗？', th: 'ผมหลงทาง ช่วยผมได้ไหมครับ' } },
  { id: 'police', cat: 'help', vi: 'Gọi cảnh sát giúp tôi, tôi bị mất đồ.', t: { en: 'Please call the police. My belongings were stolen.', es: 'Llame a la policía, por favor. Me han robado.', fr: "Appelez la police, s'il vous plaît. On m'a volé mes affaires.", ja: '警察を呼んでください。盗難に遭いました。', ko: '경찰을 불러 주세요. 물건을 도난당했어요.', zh: '请报警，我的东西被偷了。', th: 'ช่วยโทรเรียกตำรวจด้วยครับ ของผมถูกขโมย' } },
]

/** Phrases of one category in the given language (vi text kept alongside so the page can show both). */
export function phrasesFor(cat: PhraseCat | 'all', lang: LumiLang): { id: string; vi: string; text: string }[] {
  return PHRASES.filter((p) => cat === 'all' || p.cat === cat).map((p) => ({ id: p.id, vi: p.vi, text: p.t[lang] }))
}

export function speechTag(lang: LumiLang): string {
  return LUMI_LANGS.find((l) => l.code === lang)?.speech ?? 'en-US'
}

export function isLumiLang(v: unknown): v is LumiLang {
  return typeof v === 'string' && LUMI_LANGS.some((l) => l.code === v)
}

/** Short etiquette tips per language/country, hand-written so they work offline. */
export const CULTURE: Record<LumiLang, { country: string; tips: { vi: string; en: string }[] }> = {
  en: { country: 'UK / US', tips: [
    { vi: 'Mỹ: tip khoảng 15-20% ở nhà hàng, thường chưa gồm trong hóa đơn.', en: 'US: tip about 15-20% at restaurants; it is usually not on the bill.' },
    { vi: 'Anh: xếp hàng nghiêm túc, chen ngang bị coi là rất thô lỗ. Tip 10-12% nếu chưa có phí phục vụ.', en: 'UK: queue properly; tip 10-12% if service is not included.' },
    { vi: 'Nói "please" và "thank you" thường xuyên, người bản xứ rất để ý.', en: 'Say "please" and "thank you" often.' },
  ] },
  es: { country: 'España / Mỹ Latin', tips: [
    { vi: 'Bữa trưa muộn (14-15h), bữa tối sau 21h. Nhiều quán đóng cửa buổi chiều.', en: 'Lunch is late (2-3pm), dinner after 9pm; many shops close mid-afternoon.' },
    { vi: 'Ở Tây Ban Nha tip ít (làm tròn là đủ); ở Mỹ Latin thường 10%.', en: 'Tips are small in Spain (rounding up); about 10% in Latin America.' },
    { vi: 'Chào bằng cách hôn má nhẹ ở nhiều nơi, người ta thường đứng gần khi nói chuyện.', en: 'Cheek kisses are common greetings; people stand close.' },
  ] },
  fr: { country: 'Pháp', tips: [
    { vi: 'Luôn chào "Bonjour" khi bước vào quán, tiệm. Không chào bị xem là bất lịch sự.', en: 'Always say "Bonjour" when entering a shop or cafe.' },
    { vi: 'Hóa đơn đã gồm phí phục vụ; để thêm vài euro lẻ là đủ.', en: 'Service is included; leaving small change is enough.' },
    { vi: 'Nhà hàng không mang hóa đơn cho đến khi anh xin: "L\'addition, s\'il vous plaît".', en: 'The bill only comes when you ask for it.' },
  ] },
  ja: { country: 'Nhật Bản', tips: [
    { vi: 'Không tip. Để tiền tip có thể làm họ khó xử.', en: 'No tipping.' },
    { vi: 'Cởi giày khi vào nhà, một số quán ăn và phòng trà. Giữ yên lặng trên tàu, không nói điện thoại.', en: 'Take shoes off where asked; stay quiet on trains and avoid phone calls.' },
    { vi: 'Đặt tiền vào khay nhỏ thay vì đưa tận tay. Không cắm đũa thẳng đứng vào cơm.', en: 'Put money on the small tray; never stick chopsticks upright in rice.' },
  ] },
  ko: { country: 'Hàn Quốc', tips: [
    { vi: 'Không cần tip. Đưa và nhận đồ bằng hai tay với người lớn tuổi.', en: 'No tipping; use both hands when giving or receiving from elders.' },
    { vi: 'Đợi người lớn tuổi cầm đũa/thìa trước khi ăn.', en: 'Wait for the eldest to start eating.' },
    { vi: 'Nhiều quán ăn mang nước và banchan miễn phí, đừng ngại xin thêm.', en: 'Side dishes and water are often free; refills are normal.' },
  ] },
  zh: { country: 'Trung Quốc', tips: [
    { vi: 'Thanh toán chủ yếu qua Alipay/WeChat Pay; mang thêm một ít tiền mặt phòng khi thẻ không dùng được.', en: 'Mobile payment dominates; carry some cash as backup.' },
    { vi: 'Không cần tip. Trả giá ở chợ là bình thường, ở cửa hàng thì không.', en: 'No tipping; bargaining is normal at markets, not in shops.' },
    { vi: 'Không cắm đũa thẳng đứng vào bát cơm.', en: 'Never stick chopsticks upright in rice.' },
  ] },
  th: { country: 'Thái Lan', tips: [
    { vi: 'Chào bằng cách chắp tay nhẹ ("wai"), không chạm vào đầu người khác.', en: 'Greet with a slight wai; never touch someone\'s head.' },
    { vi: 'Cởi giày khi vào đền và nhà. Ăn mặc kín đáo khi vào đền (che vai, đầu gối).', en: 'Take shoes off; cover shoulders and knees at temples.' },
    { vi: 'Tip nhỏ (20-50 baht) được hoan nghênh nhưng không bắt buộc. Tôn trọng hoàng gia, không đùa về chủ đề này.', en: 'Small tips are welcome; always show respect for the monarchy.' },
  ] },
}

/** English names, used in AI prompts. */
export const LANG_EN: Record<LumiLang, string> = { en: 'English', es: 'Spanish', fr: 'French', ja: 'Japanese', ko: 'Korean', zh: 'Simplified Chinese', th: 'Thai' }

/** Common tourist scams per country, hand-written (offline). Lumi's Listen also flags them live. */
export const SCAMS: Record<LumiLang, { vi: string; en: string }[]> = {
  en: [
    { vi: 'Người lạ "tặng" vòng tay/hoa hồng rồi đòi tiền.', en: 'Strangers "gift" a bracelet or rose, then demand money.' },
    { vi: 'Máy ATM lạ ở chỗ vắng có thể gắn thiết bị đọc thẻ; dùng ATM trong ngân hàng.', en: 'Lonely street ATMs may have skimmers; use bank ATMs.' },
  ],
  es: [
    { vi: 'Móc túi ở tàu điện và quảng trường đông người (Barcelona, Madrid).', en: 'Pickpockets on metros and busy squares.' },
    { vi: 'Người giả đánh rơi đồ / hỏi đường để đánh lạc hướng trong khi đồng bọn móc túi.', en: 'Fake "you dropped this" or map questions as a distraction.' },
  ],
  fr: [
    { vi: 'Ở Paris: nhóm xin chữ ký "từ thiện" rồi đòi tiền, hoặc móc túi khi anh ký.', en: 'Paris: "charity petition" groups who pickpocket or demand money.' },
    { vi: 'Trò nhặt được nhẫn vàng rồi bán lại cho anh.', en: 'The "found a gold ring" trick.' },
  ],
  ja: [
    { vi: 'Ít lừa đảo. Cẩn thận quán bar có người mời chào ở Kabukicho/Roppongi: hóa đơn rất cao.', en: 'Rare, but avoid touts for bars in Kabukicho/Roppongi: huge bills.' },
    { vi: 'Đi taxi hợp pháp (biển xanh), không đi xe "trắng" nhận khách lậu ở sân bay.', en: 'Use licensed taxis, not unlicensed airport "white" cars.' },
  ],
  ko: [
    { vi: 'Taxi không bật đồng hồ hoặc đi vòng; dùng app Kakao T để thấy giá trước.', en: 'Taxis without meter or long routes; Kakao T shows the fare.' },
    { vi: 'Người lạ mời đi "lễ hội văn hóa" hay "trà đạo" thường là dụ vào nhóm tôn giáo hoặc bán hàng.', en: 'Invitations to "culture events" or tea can be recruitment or sales.' },
  ],
  zh: [
    { vi: 'Trò mời uống trà/cà phê "luyện tiếng Anh" rồi đưa hóa đơn rất cao.', en: 'The "practice English over tea" trick with a huge bill.' },
    { vi: 'Tiền giả khi thối tiền mặt; ưu tiên thanh toán điện thoại.', en: 'Fake notes in change; prefer mobile payment.' },
  ],
  th: [
    { vi: 'Tuk-tuk "chỉ 20 baht" rồi chở vào tiệm đá quý/may đồ.', en: 'The "20 baht tuk-tuk" that detours to gem or tailor shops.' },
    { vi: 'Người lạ nói "cung điện hôm nay đóng cửa" để dẫn anh đi nơi khác; kiểm tra ở cổng chính.', en: '"The palace is closed today" — check at the official gate.' },
    { vi: 'Cho thuê xe máy rồi đòi tiền "xe bị trầy"; chụp ảnh xe trước khi nhận.', en: 'Scooter rentals claiming damage; photograph the bike first.' },
  ],
}
