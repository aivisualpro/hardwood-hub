<script setup lang="ts">
definePageMeta({ layout: false })

const router = useRouter()

const features = [
  {
    icon: '🎯',
    title: 'Skills Assessment',
    desc: 'Map and evaluate every employee\'s skill set with precision — from technical expertise to soft skills.',
  },
  {
    icon: '📈',
    title: 'Growth Tracking',
    desc: 'Monitor individual and team progress over time with visual improvement timelines and milestone markers.',
  },
  {
    icon: '🏆',
    title: 'Performance Levels',
    desc: 'Define custom skill levels per role, department, or discipline and benchmark against industry standards.',
  },
  {
    icon: '🔔',
    title: 'Smart Alerts',
    desc: 'Get notified when employees hit improvement goals, stagnate, or are ready for the next level.',
  },
  {
    icon: '📊',
    title: 'Analytics & Reports',
    desc: 'Deep-dive into workforce capability data with beautiful dashboards and exportable insights.',
  },
  {
    icon: '🤝',
    title: 'Team Collaboration',
    desc: 'Managers and employees work together on growth plans, feedback cycles, and career development paths.',
  },
]

const stats = [
  { value: '500+', label: 'Employees Tracked' },
  { value: '98%', label: 'Manager Satisfaction' },
  { value: '3×', label: 'Faster Skill Growth' },
  { value: '40+', label: 'Skill Categories' },
]
</script>

<template>
  <div class="home-root">

    <!-- NAV BAR -->
    <header class="home-nav">
      <div class="home-nav-inner">
        <div class="home-brand">
          <img src="/logo-192.png" alt="Hardwood Hub" class="home-logo" />
          <span class="home-brand-name">Hardwood Hub</span>
        </div>
        <button class="home-cta-btn" @click="router.push('/admin/dashboard')">
          Enter App →
        </button>
      </div>
    </header>

    <!-- HERO -->
    <section class="hero-section">
      <!-- LEFT: image panel -->
      <div class="hero-left">
        <img src="/hardwood image.png" alt="Hardwood Hub workspace" class="hero-image" />
        <div class="hero-left-overlay" />
      </div>

      <!-- RIGHT: content panel -->
      <div class="hero-right">
        <div class="hero-badge">Employee Skills &amp; Growth Platform</div>
        <h1 class="hero-title">
          Unlock Every
          <span class="hero-title-accent">Employee's</span>
          Full Potential
        </h1>
        <p class="hero-subtitle">
          Hardwood Hub gives managers and HR teams a powerful platform to track, develop,
          and celebrate employee skills — building a stronger, smarter workforce every day.
        </p>
        <div class="hero-actions">
          <button class="btn-primary" @click="router.push('/admin/dashboard')">
            Get Started
          </button>
          <button class="btn-secondary" @click="router.push('/tasks')">
            View Tasks
          </button>
        </div>
      </div>
    </section>

    <!-- STATS -->
    <section class="stats-section">
      <div class="stats-grid">
        <div v-for="stat in stats" :key="stat.label" class="stat-item">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section class="features-section">
      <div class="features-inner">
        <div class="section-header">
          <h2 class="section-title">Everything You Need to Build a <span class="accent">World-Class Team</span></h2>
          <p class="section-sub">Purpose-built tools for skills management, performance tracking, and employee growth — all in one place.</p>
        </div>
        <div class="features-grid">
          <div v-for="feature in features" :key="feature.title" class="feature-card">
            <div class="feature-icon">{{ feature.icon }}</div>
            <h3 class="feature-title">{{ feature.title }}</h3>
            <p class="feature-desc">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA BANNER -->
    <section class="cta-section">
      <div class="cta-inner">
        <h2 class="cta-title">Ready to Transform Your Workforce?</h2>
        <p class="cta-sub">Join Hardwood Hub and start building a culture of continuous growth and excellence today.</p>
        <button class="btn-primary btn-large" @click="router.push('/admin/dashboard')">
          Launch Dashboard →
        </button>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="home-footer">
      <img src="/logo-192.png" alt="Hardwood Hub" class="footer-logo" />
      <p class="footer-copy">© {{ new Date().getFullYear() }} Hardwood Hub. All rights reserved.</p>
    </footer>

  </div>
</template>

<style scoped>
/* ---------- ROOT ---------- */
.home-root {
  min-height: 100vh;
  overflow-y: auto;
  background: #0a0a0f;
  color: #f0f0f5;
  font-family: 'Inter', system-ui, sans-serif;
}

/* ---------- NAV ---------- */
.home-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.home-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.home-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.home-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
}
.home-brand-name {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}
.home-cta-btn {
  background: linear-gradient(135deg, #d4a853, #b8892e);
  color: #0a0a0f;
  font-weight: 700;
  font-size: 0.875rem;
  padding: 0.5rem 1.25rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  letter-spacing: 0.01em;
}
.home-cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }

/* ---------- HERO ---------- */
.hero-section {
  display: flex;
  flex-direction: row;
  min-height: calc(100vh - 64px);
  overflow: hidden;
}

/* LEFT panel */
.hero-left {
  position: relative;
  flex: 1;
  min-height: 100%;
  overflow: hidden;
}
.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.hero-left-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    transparent 60%,
    rgba(10,10,15,0.7) 100%
  );
}

/* RIGHT panel */
.hero-right {
  flex: 0 0 50%;
  max-width: 50%;
  background: #0a0a0f;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.75rem;
  padding: 4rem 3.5rem;
}

@media (max-width: 860px) {
  .hero-section { flex-direction: column; }
  .hero-left { min-height: 45vh; flex: unset; }
  .hero-right { flex: unset; max-width: 100%; padding: 3rem 2rem; }
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 1rem;
  border-radius: 999px;
  background: rgba(212, 168, 83, 0.15);
  border: 1px solid rgba(212, 168, 83, 0.35);
  color: #d4a853;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.hero-title {
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #fff;
  margin: 0;
}
.hero-title-accent {
  background: linear-gradient(135deg, #d4a853, #f0c96a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-subtitle {
  font-size: 1.15rem;
  color: rgba(240,240,245,0.7);
  max-width: 600px;
  line-height: 1.7;
  margin: 0;
}
.hero-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

/* ---------- BUTTONS ---------- */
.btn-primary {
  background: linear-gradient(135deg, #d4a853, #b8892e);
  color: #0a0a0f;
  font-weight: 700;
  font-size: 1rem;
  padding: 0.875rem 2rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 4px 24px rgba(212, 168, 83, 0.35);
}
.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-2px);
  box-shadow: 0 8px 36px rgba(212, 168, 83, 0.45);
}
.btn-primary.btn-large {
  font-size: 1.1rem;
  padding: 1rem 2.5rem;
}
.btn-secondary {
  background: rgba(255,255,255,0.08);
  color: #fff;
  font-weight: 600;
  font-size: 1rem;
  padding: 0.875rem 2rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.15);
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  backdrop-filter: blur(8px);
}
.btn-secondary:hover {
  background: rgba(255,255,255,0.14);
  transform: translateY(-2px);
}

/* ---------- STATS ---------- */
.stats-section {
  background: rgba(255,255,255,0.03);
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 3rem 2rem;
}
.stats-grid {
  max-width: 900px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
  text-align: center;
}
@media (max-width: 640px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
.stat-value {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #d4a853, #f0c96a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 0.5rem;
}
.stat-label {
  font-size: 0.875rem;
  color: rgba(240,240,245,0.55);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ---------- FEATURES ---------- */
.features-section {
  padding: 6rem 2rem;
}
.features-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.section-header {
  text-align: center;
  margin-bottom: 3.5rem;
}
.section-title {
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #fff;
  line-height: 1.15;
  margin-bottom: 1rem;
}
.accent {
  background: linear-gradient(135deg, #d4a853, #f0c96a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.section-sub {
  color: rgba(240,240,245,0.55);
  font-size: 1.05rem;
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.7;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
@media (max-width: 900px) {
  .features-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .features-grid { grid-template-columns: 1fr; }
}
.feature-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 1.75rem;
  transition: background 0.2s, transform 0.2s, border-color 0.2s;
}
.feature-card:hover {
  background: rgba(212, 168, 83, 0.07);
  border-color: rgba(212, 168, 83, 0.25);
  transform: translateY(-3px);
}
.feature-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}
.feature-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 0.5rem;
}
.feature-desc {
  font-size: 0.9rem;
  color: rgba(240,240,245,0.55);
  line-height: 1.65;
  margin: 0;
}

/* ---------- CTA BANNER ---------- */
.cta-section {
  padding: 6rem 2rem;
  background: linear-gradient(135deg, rgba(212,168,83,0.1) 0%, rgba(184,137,46,0.05) 100%);
  border-top: 1px solid rgba(212,168,83,0.15);
  border-bottom: 1px solid rgba(212,168,83,0.15);
}
.cta-inner {
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}
.cta-title {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  margin: 0;
}
.cta-sub {
  color: rgba(240,240,245,0.6);
  font-size: 1.05rem;
  line-height: 1.7;
  margin: 0;
}

/* ---------- FOOTER ---------- */
.home-footer {
  padding: 2.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.footer-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
  opacity: 0.6;
}
.footer-copy {
  font-size: 0.8rem;
  color: rgba(240,240,245,0.3);
  margin: 0;
}
</style>
