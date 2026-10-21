import assetsData from '../../assets/assets_base64.json';

export const FRONT_LOGO_BASE64 = `data:image/png;base64,${assetsData.frontLogo}`;
export const ISSUING_SIG_BASE64 = `data:image/png;base64,${assetsData.issuingSig}`;
export const FOOTER_PILLAR_BASE64 = `data:image/png;base64,${assetsData.footerPillar}`;
export const BACK_FOOTER_LOGO_BASE64 = `data:image/png;base64,${assetsData.backFooterLogo}`;

export const CARD_ASSETS = {
  frontLogo: FRONT_LOGO_BASE64,
  issuingSig: ISSUING_SIG_BASE64,
  footerPillar: FOOTER_PILLAR_BASE64,
  backFooterLogo: BACK_FOOTER_LOGO_BASE64,
};
