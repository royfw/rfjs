import type { LocaleMessages } from "./types";

import { messages as typeConverter } from "./type-converter/messages";

// As each tool is migrated, add its messages fragment here (i18n only, no component import).
export const toolMessages: LocaleMessages[] = [typeConverter];
