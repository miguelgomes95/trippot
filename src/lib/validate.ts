// Input checks shared by the forms and the server actions.

// PayPal rejects invoice recipients with non-ASCII characters (e.g. "inês@"), so we do too.
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export const isValidEmail = (email: string) => EMAIL.test(email);

export type TravellerInput = { name: string; email: string; notes: string | null };

/** Parses one traveller per line, "Name, email, notes" (notes optional and may contain commas). */
export function parseTravellers(text: string) {
  const travellers: TravellerInput[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  text
    .split("\n")
    .map((l) => l.trim())
    .forEach((line, i) => {
      if (!line) return;
      const [name = "", email = "", ...rest] = line.split(",").map((p) => p.trim());
      const at = `Line ${i + 1}`;
      if (!name || !email) return errors.push(`${at}: write it as "Name, email" with optional notes after.`);
      if (!isValidEmail(email))
        return errors.push(`${at}: "${email}" isn't an email PayPal accepts. Use letters without accents.`);
      if (seen.has(email.toLowerCase())) return errors.push(`${at}: ${email} is already on the list.`);
      seen.add(email.toLowerCase());
      travellers.push({ name, email, notes: rest.join(", ") || null });
    });

  if (!travellers.length && !errors.length) errors.push("Add at least one traveller.");
  return { travellers, errors };
}
