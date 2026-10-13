import "server-only";
/**
 * E'lonlar va takliflar (Upwork uslubi) — boshqa modullar uchun ochiq API:
 *  closeExpiredJobs() — kunlik cron (/api/cron/daily): muddati o'tgan ochiq e'lonlarni yopadi, egasiga xabar beradi
 *  countOpenJobs()    — bosh sahifa tizeri: ochiq e'lonlar soni
 *  listLatestJobs(n)  — bosh sahifa: eng yangi ochiq e'lonlar (ommaviy DTO)
 *  getSitemapJobs()   — sitemap: ochiq e'lonlar id + updatedAt
 */
export { closeExpiredJobs } from "./service";
export { countOpenJobs, getSitemapJobs, listLatestJobs, type JobListItem } from "./queries";
export { budgetLabel, jobRegionLabel, jobCategoryLabel, proposalsCountLabel } from "./format";
