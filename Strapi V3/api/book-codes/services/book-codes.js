'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
  getSlugCourse: (ctx) => {
    const { grade } = ctx;
    let courseSlugToSearch;
    switch (grade) {
      case 0:
        courseSlugToSearch = 'inicial-2';
        break;
      case 1:
        courseSlugToSearch = 'primero-egb';
        break;
      case 2:
        courseSlugToSearch = 'segundo-egb';
        break;
      case 3:
        courseSlugToSearch = 'tercero-egb';
        break;
      case 4:
        courseSlugToSearch = 'cuarto-egb';
        break;
      case 5:
        courseSlugToSearch = 'quinto-egb';
        break;
      case 6:
        courseSlugToSearch = 'sexto-egb';
        break;
      case 7:
        courseSlugToSearch = 'septimo-egb';
        break;
      case 8:
        courseSlugToSearch = 'octavo-egb';
        break;
      case 9:
        courseSlugToSearch = 'noveno-egb';
        break;
      case 10:
        courseSlugToSearch = 'decimo-egb';
        break;
      case 11:
        courseSlugToSearch = 'primero-bachillerato';
        break;
      case 12:
        courseSlugToSearch = 'segundo-bachillerato';
        break;
      case 13:
        courseSlugToSearch = 'tercero-bachillerato';
        break;
      case 14:
        courseSlugToSearch = 'inicial-2-foundation';
        break;
      case 15:
        courseSlugToSearch = 'primero-egb-foundation';
        break;
      case 16:
        courseSlugToSearch = 'segundo-egb-foundation';
        break;
      case 17:
        courseSlugToSearch = 'tercero-egb-foundation';
        break;
      case 18:
        courseSlugToSearch = 'cuarto-egb-foundation';
        break;
      case 19:
        courseSlugToSearch = 'quinto-egb-foundation';
        break;
      case 20:
        courseSlugToSearch = 'sexto-egb-foundation';
        break;
      case 21:
        courseSlugToSearch = 'septimo-egb-foundation';
        break;
      case 22:
        courseSlugToSearch = 'octavo-egb-foundation';
        break;
      case 23:
        courseSlugToSearch = 'noveno-egb-foundation';
        break;
      case 24:
        courseSlugToSearch = 'decimo-egb-foundation';
        break;
      case 25:
        courseSlugToSearch = '1ro-bachillerato-F';
        break;
      case 26:
        courseSlugToSearch = '2do-bachillerato-F';
        break;
      case 27:
        courseSlugToSearch = '3ro-bachillerato-F';
        break;
    }
    return courseSlugToSearch;
  },
};
