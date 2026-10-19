import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/** Shared institution palette, used by every PrimeNG component and overlay. */
export const PhilharmonicPreset = definePreset(Aura, {
  primitive: { borderRadius: { none: '0', xs: '2px', sm: '2px', md: '3px', lg: '4px', xl: '6px' } },
  semantic: {
    primary: {
      50: '#faf7f0',
      100: '#f0e8d7',
      200: '#e4d5b5',
      300: '#d6bf92',
      400: '#c7ab72',
      500: '#a98a4b',
      600: '#8e7037',
      700: '#79602e',
      800: '#5c4824',
      900: '#3d301a',
      950: '#211b10',
    },
    focusRing: { width: '2px', style: 'solid', color: '#79602e', offset: '3px' },
    formField: {
      paddingX: '0.85rem',
      paddingY: '0.8rem',
      borderRadius: '2px',
      focusRing: { width: '2px', style: 'solid', color: '#79602e', offset: '2px' },
    },
    colorScheme: {
      light: {
        primary: {
          color: '#c7ab72',
          contrastColor: '#131313',
          hoverColor: '#dfc28b',
          activeColor: '#bda06a',
        },
        highlight: {
          background: '#eee7d9',
          focusBackground: '#e3d5b7',
          color: '#131313',
          focusColor: '#131313',
        },
        surface: {
          0: '#ffffff',
          50: '#faf9f7',
          100: '#f5f3ef',
          200: '#e4e2dc',
          300: '#cdc9c0',
          400: '#a6a198',
          500: '#77726a',
          600: '#686763',
          700: '#4a4741',
          800: '#302d28',
          900: '#131313',
          950: '#090909',
        },
        formField: {
          background: '#ffffff',
          disabledBackground: '#f5f3ef',
          borderColor: '#cdc9c0',
          hoverBorderColor: '#79602e',
          focusBorderColor: '#79602e',
          color: '#131313',
          placeholderColor: '#686763',
        },
        content: {
          background: '#ffffff',
          borderColor: '#e4e2dc',
          color: '#131313',
          hoverBackground: '#f5f3ef',
          hoverColor: '#131313',
        },
        text: {
          color: '#131313',
          hoverColor: '#131313',
          mutedColor: '#686763',
          hoverMutedColor: '#4a4741',
        },
      },
    },
  },
  components: {
    card: { root: { borderRadius: '0', shadow: 'none' }, body: { padding: '0', gap: '0' } },
    button: {
      root: {
        borderRadius: '2px',
        paddingX: '1.4rem',
        paddingY: '0.9rem',
        gap: '0.8rem',
        fontWeight: '600',
      },
    },
    accordion: {
      header: { padding: '1.4rem 0', fontWeight: '500' },
      content: { padding: '0 0 1.4rem' },
    },
    progressbar: { root: { height: '3px', borderRadius: '0' }, label: { fontSize: '0' } },
    checkbox: { root: { width: '20px', height: '20px', borderRadius: '2px' } },
    select: { root: { borderRadius: '2px' } },
    tag: {
      root: {
        borderRadius: '2px',
        fontSize: '0.65rem',
        fontWeight: '500',
        padding: '0.45rem 0.7rem',
      },
    },
  },
});
