import type { Aspect, NegativeTag, PositiveTag } from '../../types/review';

/** `(?<!\p{L})` / `(?!\p{L})` act as Unicode-aware word boundaries. */
const B = '(?<!\\p{L})';
const E = '(?!\\p{L})';
const re = (body: string) => new RegExp(`${B}(?:${body})${E}`, 'giu');

export const ASPECT_LABELS: Record<Aspect, string> = {
  size: 'Size & fit',
  material: 'Material',
  quality: 'Quality',
  shipping: 'Shipping & delivery',
  durability: 'Durability',
  packaging: 'Packaging',
  functionality: 'Functionality',
  description: 'Matches description',
  value: 'Value for money',
  usability: 'Ease of use',
};

export const ASPECT_PATTERNS: Record<Aspect, RegExp> = {
  size: re('size|sizes|sizing|small|smaller|big|bigger|large|larger|tiny|huge|fit|fits|fitting|tight|loose|length|width|dimensions?|cm|inch(es)?|talla|tamanho|taille|größe|размер|kích thước|size nhỏ'),
  material: re('material|materials|fabric|plastic|metal|steel|aluminum|aluminium|leather|cotton|silicone|rubber|wood|wooden|glass|polyester|nylon|tela|tecido|tissu|stoff|материал|ткань|chất liệu|vải|nhựa'),
  quality: re('quality|qualities|well made|poorly made|craftsmanship|build|calidad|qualidade|qualité|qualität|качество|chất lượng'),
  shipping: re('shipping|shipped|delivery|delivered|arrived|arrival|courier|tracking|parcel|package arrived|post|customs|days|weeks|envío|entrega|llegó|chegou|entrega|livraison|lieferung|доставка|пришл[оа]|giao hàng|ship'),
  durability: re('durable|durability|lasted|lasts|last long|broke|broken|break|breaks|fell apart|falls apart|wear|worn|after (a|one|two|few) (day|week|month)s?|sturdy|flimsy|fragile|duradero|resistente|durável|solide|langlebig|прочн\\p{L}*|bền'),
  packaging: re('packaging|packaged|packed|package|packing|box|boxes|wrapped|bubble wrap|embalaje|embalagem|emballage|verpackung|упаковка|đóng gói|hộp'),
  functionality: re('works?|worked|working|function(s|ing|al)?|stopped|turns? on|charge|charging|battery|power|funciona|fonctionne|funktioniert|работает|hoạt động|dùng được'),
  description: re('as described|description|described|as pictured|as shown|in the (photo|picture)s?|looks like|same as|different from|not like|advertised|misleading|descripción|descrição|description|beschreibung|описани\\p{L}*|như hình|đúng mô tả|giống hình'),
  value: re('price|priced|value|worth|money|cheap|expensive|overpriced|bargain|deal|precio|preço|prix|preis|цена|giá|đáng tiền'),
  usability: re('easy|easier|difficult|hard to|simple|instructions?|manual|install(ation|ed)?|setup|set up|assemble|assembly|use|using|fácil|difícil|facile|einfach|удобн\\p{L}*|dễ dùng|khó dùng'),
};

export const POSITIVE_TAG_LABELS: Record<PositiveTag, string> = {
  'works-well': 'Works well',
  'good-quality': 'Good quality',
  'as-described': 'As described',
  'good-packaging': 'Well packaged',
  satisfied: 'Customer satisfied',
  'good-value': 'Good value',
  'on-time-delivery': 'Delivered on time',
};

export const NEGATIVE_TAG_LABELS: Record<NegativeTag, string> = {
  defective: 'Defective',
  'poor-quality': 'Poor quality',
  'not-as-described': 'Not as described',
  'wrong-size': 'Size mismatch',
  'missing-parts': 'Missing parts',
  'damaged-in-shipping': 'Damaged in transit',
  'slow-shipping': 'Slow shipping',
  'not-working': 'Not working',
  'hard-to-use': 'Hard to use',
  'not-worth-it': 'Not worth the money',
};

/** Positive tags are skipped when the match is preceded by a negator ("not good quality"). */
export const POSITIVE_TAG_PATTERNS: Record<PositiveTag, RegExp> = {
  'works-well': re('works? (great|well|perfectly|fine|as expected)|working (great|perfectly|fine)|works like a charm|funciona (bien|perfecto|perfeitamente|muito bem)|fonctionne (bien|parfaitement)|funktioniert (gut|super|einwandfrei)|работает (хорошо|отлично)|hoạt động tốt|dùng tốt|functions? (well|perfectly)'),
  'good-quality': re('(good|great|excellent|high|nice|top|amazing|superb|very good) quality|quality is (good|great|excellent|amazing|very good)|well made|well built|buena calidad|boa qualidade|bonne qualité|gute qualität|хорошее качество|chất lượng tốt|hàng tốt'),
  'as-described': re('as described|as pictured|as shown|as advertised|exactly like (the )?(picture|photo|description)s?|matches (the )?(description|picture|photo)s?|same as (the )?(picture|photo|description)|como se describe|como na foto|conforme (a )?descrição|conforme à la description|wie beschrieben|соответствует описанию|đúng mô tả|giống hình|như hình'),
  'good-packaging': re('(well|nicely|securely|carefully|good|perfectly) (packed|packaged|wrapped)|(good|great|nice|excellent|secure) (packaging|package|packing)|bien embalado|bem embalado|bien emballé|gut verpackt|хорошо упаковано|đóng gói (cẩn thận|kỹ|đẹp|tốt)'),
  satisfied: re('(very |really |totally )?(satisfied|happy|pleased|love it|love this|loved it|recommend)|muy contento|satisfecho|satisfeito|recomiendo|recomendo|satisfait|je recommande|zufrieden|empfehlenswert|доволен|довольна|рекомендую|hài lòng|ưng ý|rất thích'),
  'good-value': re('(good|great|excellent) (value|price|deal)|value for money|worth (it|the money|every penny|the price)|for the price|bang for (the|your) buck|buen precio|bom preço|rapport qualité[- ]prix|preis[- ]leistung|за такую цену|đáng tiền|giá tốt|giá rẻ mà'),
  'on-time-delivery': re('(fast|quick|rapid|speedy) (shipping|delivery)|arrived (quickly|fast|early|on time|before|ahead)|delivered (quickly|fast|on time|early)|on time|envío rápido|entrega rápida|chegou rápido|livraison rapide|schnelle lieferung|быстрая доставка|giao hàng nhanh|giao nhanh'),
};

export const NEGATIVE_TAG_PATTERNS: Record<NegativeTag, RegExp> = {
  defective: re('defective|faulty|defect|defects|manufacturing (fault|defect)|broken out of the box|arrived broken|dead on arrival|doa|defectuoso|defeituoso|com defeito|défectueux|defekt|брак|бракованн\\p{L}*|bị lỗi|hàng lỗi'),
  'poor-quality': re('(poor|bad|low|terrible|cheap|awful|horrible) quality|quality is (poor|bad|low|terrible|awful)|cheaply made|poorly made|flimsy|feels cheap|looks cheap|mala calidad|baja calidad|qualidade (ruim|baixa)|mauvaise qualité|schlechte qualität|плохое качество|chất lượng kém|kém chất lượng'),
  'not-as-described': re('not as described|not as pictured|not as shown|not as advertised|not like (the )?(picture|photo|description)s?|different from (the )?(picture|photo|description|ad)s?|does ?n[o\']?t match (the )?(description|picture|photo)s?|misleading|false advertising|not what i ordered|wrong (item|product|colou?r|model)|no es como|diferente da foto|pas conforme|nicht wie beschrieben|не соответствует|không giống hình|không đúng mô tả'),
  'wrong-size': re('(too|very|way|much) (small|big|large|tight|loose|short|long)|smaller than (expected|described|pictured|shown|advertised|i thought)|bigger than (expected|described|pictured|shown)|runs (small|large|big)|wrong size|size (is|was) (wrong|off|too)|does ?n[o\']?t fit|did ?n[o\']?t fit|muy pequeño|talla incorrecta|muito pequeno|trop petit|zu klein|маломерит|размер не|size nhỏ|chật|quá nhỏ'),
  'missing-parts': re('missing|not included|wasn\'?t included|were not included|incomplete|parts? (missing|absent)|no (screws|cable|charger|battery|instructions|manual|accessories)|came without|faltan|falta|faltando|manquant|fehlt|fehlen|не хватает|отсутству\\p{L}*|thiếu'),
  'damaged-in-shipping': re('arrived (damaged|broken|cracked|crushed|smashed|dented|scratched|torn)|damaged (in|during) (shipping|transit|delivery)|(box|package|parcel) (was )?(damaged|crushed|torn|opened)|broken in transit|llegó (roto|dañado)|chegou (quebrado|danificado)|arrivé cassé|beschädigt angekommen|пришл\\p{L}* (сломан\\p{L}*|разбит\\p{L}*|поврежден\\p{L}*)|bị móp|bị vỡ|vỡ khi giao'),
  'slow-shipping': re('(slow|long|late) (shipping|delivery)|took (forever|ages|too long|a long time|over a month|\\d+ (days|weeks|months))|(still )?(has|have)n\'?t arrived|never arrived|never received|did ?n[o\']?t (arrive|receive)|delayed|delay|took (almost |nearly |more than )?(a|one|two|three|\\d+) months?|envío lento|tardó|demorou|entrega lenta|livraison lente|lange lieferzeit|долгая доставка|долго шл\\p{L}*|giao (hàng )?chậm|ship chậm'),
  'not-working': re('(does ?n[o\']?t|did ?n[o\']?t|do ?n[o\']?t|won\'?t|will not|is ?n[o\']?t|not) (work|working|turn on|charge|power on)|stopped working|quit working|no longer works|dead|does nothing|no funciona|dejó de funcionar|não funciona|parou de funcionar|ne fonctionne pas|funktioniert nicht|не работает|перестал\\p{L}* работать|không hoạt động|không dùng được|không chạy'),
  'hard-to-use': re('hard to (use|install|assemble|set up|setup|operate|understand)|difficult to (use|install|assemble|set up|operate|understand)|confusing|no instructions|instructions (are|were) (useless|unclear|missing|in chinese)|complicated|difícil de usar|difícil de usar|difficile à utiliser|schwer zu bedienen|сложно (пользоваться|установить)|khó dùng|khó sử dụng|khó lắp'),
  'not-worth-it': re('not worth (it|the money|the price)|waste of money|overpriced|too expensive|rip[- ]?off|scam|money down the drain|no vale la pena|não vale a pena|pas la peine|nicht wert|не стоит своих денег|không đáng tiền|phí tiền'),
};
