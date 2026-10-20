// Authentic reference template artwork for Front and Back sides.
// Dimensions match original Photoshop exports: 284px width x 500px height.

export const FRONT_TEMPLATE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 284 500" width="284" height="500">
  <defs>
    <clipPath id="frontCardClip">
      <rect width="284" height="500" rx="14" ry="14"/>
    </clipPath>
  </defs>
  
  <g clip-path="url(#frontCardClip)">
    <!-- White Card Background -->
    <rect width="284" height="500" fill="#FFFFFF"/>
    
    <!-- Top Pink Header -->
    <rect x="0" y="0" width="284" height="112" fill="#FCD0CC"/>
    
    <!-- Top Pink Header (Logo is overlaid via supplied high-res transparent PNG) -->
    <rect x="0" y="0" width="284" height="112" fill="#FCD0CC"/>
    
    <!-- Fixed 2x2 Grid Labels on White Body -->
    <text x="18" y="248" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="9" fill="#000000" letter-spacing="0.4">JOB TYPE</text>
    <text x="152" y="248" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="9" fill="#000000" letter-spacing="0.4">JOINING DATE</text>
    
    <text x="18" y="300" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="9" fill="#000000" letter-spacing="0.4">ENROLL ID</text>
    <text x="152" y="300" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="9" fill="#000000" letter-spacing="0.4">CARD ISSUE</text>
    
    <!-- Issuing Authority Signature & Line (Exact reference asset) -->
    <image href="/assets/issuing_authority_signature.png" x="78" y="356" width="70" height="52" preserveAspectRatio="xMidYMid meet"/>
    
    <!-- Employee Signature Caption (Area above it is reserved for signature overlay, no box) -->
    <line x1="16" y1="398" x2="92" y2="398" stroke="#94A3B8" stroke-width="0.8"/>
    <text x="54" y="408" font-family="Arial, Helvetica, sans-serif" font-size="7.5" fill="#334155" text-anchor="middle">employee</text>

    <!-- Bottom Red Banner -->
    <rect x="0" y="438" width="284" height="62" fill="#E31B23"/>
    
    <!-- Black Pillar Logo Icon overlapping into red banner -->
    <image href="/assets/footer_pillar_icon.png" x="135" y="416" width="28" height="44" preserveAspectRatio="xMidYMid meet"/>
    
    <!-- BEYOND TOMORROW Stacked Typography -->
    <text x="167" y="458" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="13" fill="#FFFFFF" letter-spacing="0.4">BEYOND</text>
    <text x="167" y="472" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="13" fill="#FFFFFF" letter-spacing="0.4">TOMORROW</text>
  </g>
</svg>
`)}`;

export const BACK_TEMPLATE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 284 500" width="284" height="500">
  <defs>
    <clipPath id="backCardClip">
      <rect width="284" height="500" rx="14" ry="14"/>
    </clipPath>
  </defs>
  
  <g clip-path="url(#backCardClip)">
    <!-- White Card Background -->
    <rect width="284" height="500" fill="#FFFFFF"/>
    
    <!-- Top Pink Header -->
    <rect x="0" y="0" width="284" height="90" fill="#FCD0CC"/>
    <text x="32" y="68" font-family="Georgia, 'Times New Roman', serif" font-size="14.5" fill="#1E293B">If found please return to:</text>
    
    <!-- AKIJ CERAMICS LIMITED and Address Info -->
    <text x="42" y="114" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="11" fill="#000000" letter-spacing="0.2">AKIJ CERAMICS LIMITED.</text>
    <text x="42" y="125" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="8" fill="#000000">Mukkhopur, Trishal, Mymensingh Bangladesh</text>
    <text x="42" y="135" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="8" fill="#000000">Call: 01920-694100, 01833-636610</text>
    
    <!-- Terracotta Rounded Container -->
    <rect x="48" y="142" width="198" height="194" rx="16" ry="16" fill="#FFFFFF" stroke="#BD5B38" stroke-width="2.6"/>
    
    <!-- Box Title -->
    <text x="54" y="166" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="10" fill="#000000" letter-spacing="0.4">EMPLOYEE INFORMATION</text>
    
    <!-- PERMANENT ADDRESS (Fixed Label + Fixed Address) -->
    <text x="54" y="190" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="8.5" fill="#000000" letter-spacing="0.2">PERMANENT ADDRESS</text>
    <text x="54" y="204" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="9.5" fill="#000000">Mukkhopur, Trishal, Mymensingh</text>
    
    <!-- EMERGENCY CONTACT (Fixed Label) -->
    <text x="54" y="228" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="8.5" fill="#000000" letter-spacing="0.2">EMERGENCY CONTACT</text>
    
    <!-- NATIONAL ID (Fixed Label) & BLOOD GROUP (Fixed Label) -->
    <text x="54" y="280" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="8.5" fill="#000000" letter-spacing="0.2">NATIONAL ID</text>
    <text x="174" y="280" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="8.5" fill="#000000" letter-spacing="0.2">BLOOD GROUP</text>
    
    <!-- VALID UNTILL REVOKED -->
    <text x="142" y="362" font-family="'Arial Black', Arial, sans-serif" font-weight="900" font-size="9.5" fill="#292524" text-anchor="middle" letter-spacing="0.8">VALID UNTILL REVOKED</text>
    
    <!-- Disclaimer Notice -->
    <text x="142" y="384" font-family="Georgia, 'Times New Roman', serif" font-size="8.5" fill="#1C1917" text-anchor="middle">In case of losing this identity card, please</text>
    <text x="142" y="396" font-family="Georgia, 'Times New Roman', serif" font-size="8.5" fill="#1C1917" text-anchor="middle">notify your managing authortity promotly.</text>
    
    <!-- Bottom Black Banner -->
    <rect x="0" y="438" width="284" height="62" fill="#000000"/>
    
    <!-- AKIJ BASHIR GROUP Logo -->
    <g transform="translate(68, 450)">
      <!-- Red Interlocking Dual-Drop / Quote Emblem -->
      <g transform="translate(0, 2)">
        <path d="M11 0 C17 0 19 5 17 9 C15 12 12 13 10 11 C8 9 8 5 11 0 Z" fill="#E32636"/>
        <path d="M7 15 C1 15 0 10 2 6 C4 3 6 2 8 4 C10 6 10 9 7 15 Z" fill="#E32636"/>
        <circle cx="12" cy="5" r="1.8" fill="#E32636"/>
        <circle cx="5" cy="10" r="1.8" fill="#E32636"/>
      </g>
      
      <!-- Text: AKIJ BASHIR GROUP -->
      <text x="24" y="15" font-family="Georgia, serif" font-weight="bold" font-size="14" fill="#FFFFFF" letter-spacing="0.8">AKIJ</text>
      <text x="61" y="15" font-family="Georgia, serif" font-size="14" fill="#FFFFFF" letter-spacing="0.8">BASHIR</text>
      <text x="25" y="25" font-family="Arial, sans-serif" font-weight="bold" font-size="6.5" fill="#FFFFFF" letter-spacing="1.5">GROUP</text>
    </g>
  </g>
</svg>
`)}`;
