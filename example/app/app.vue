<script setup lang="ts">
import { SITE } from '~/data/site';
import { DEFAULT_SETTINGS, type SnowSettings } from '~/types/snow';

const siteUrl = useRuntimeConfig().public.siteUrl;

useSeoMeta({
  title: SITE.title,
  description: SITE.description,
  ogType: 'website',
  ogSiteName: SITE.name,
  ogUrl: `${siteUrl}/`,
  ogTitle: SITE.title,
  ogDescription: SITE.description,
  twitterCard: 'summary',
  twitterTitle: SITE.title,
  twitterDescription: SITE.description,
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/` }],
  meta: [
    {
      name: 'theme-color',
      content: '#f5f7f9',
      media: '(prefers-color-scheme: light)',
    },
    {
      name: 'theme-color',
      content: '#0f131a',
      media: '(prefers-color-scheme: dark)',
    },
  ],
});

const settings = ref<SnowSettings>({ ...DEFAULT_SETTINGS });
</script>

<template>
  <div>
    <SiteBar />
    <main>
      <SnowPanel v-model="settings" />
      <!-- MapLibre and WebGPU need the browser; the map renders client-side. -->
      <ClientOnly>
        <LazySnowMap :settings="settings" />
      </ClientOnly>
    </main>
  </div>
</template>
