const ADJECTIVES = ["수줍은", "용감한", "다정한", "엉뚱한", "반짝이는", "졸린", "신나는", "조용한", "씩씩한", "포근한", "재빠른", "느긋한"];
const ANIMALS = ["고래", "여우", "판다", "수달", "펭귄", "다람쥐", "고슴도치", "부엉이", "코알라", "알파카", "햄스터", "돌고래"];

function shuffle<T>(arr: readonly T[], random: () => number): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function generateAliases(count: number, random: () => number = Math.random): string[] {
    if (count > ADJECTIVES.length * ANIMALS.length || count < 0) {
        throw new Error("닉네임 조합이 부족합니다.");
    }

    if (count <= ANIMALS.length) {
        const shuffledAnimals = shuffle(ANIMALS, random);
        const shuffledAdjectives = shuffle(ADJECTIVES, random);
        return Array.from({ length: count }, (_, i) => `${shuffledAdjectives[i % ADJECTIVES.length]} ${shuffledAnimals[i]}`);
    } else {
        const allCombinations: string[] = [];
        for (const adj of ADJECTIVES) {
            for (const animal of ANIMALS) {
                allCombinations.push(`${adj} ${animal}`);
            }
        }
        return shuffle(allCombinations, random).slice(0, count);
    }
}
