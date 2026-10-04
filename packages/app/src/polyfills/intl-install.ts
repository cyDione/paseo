import { polyfillIntl } from "./intl";
import { readIntlDeviceInfo } from "./intl-device";

polyfillIntl(readIntlDeviceInfo);
