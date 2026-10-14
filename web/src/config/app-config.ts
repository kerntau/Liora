import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "灵探 · Liora",
  englishName: "Liora",
  logo: "/lingtan-logo.png",
  version: packageJson.version,
  copyright: `© ${currentYear}, ARTEX.`,
  meta: {
    title: "灵探 · Liora — AI 辅助自动化渗透测试平台",
    description: "灵探 Liora：集成 AI 辅助决策、自动化测试、资产分析、漏洞验证与报告生成的渗透测试平台",
  },
};
