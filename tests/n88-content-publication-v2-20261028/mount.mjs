/** AI-authored synthetic host. No production route registration. */
import { mountPublicationReview } from '../../drafts/n88-student-portal/publication-v2-review.inactive.mjs';
import { fixture } from './fixture.mjs';
window.reviewFixture = fixture();
window.review = mountPublicationReview(document.querySelector('#review'), window.reviewFixture);
