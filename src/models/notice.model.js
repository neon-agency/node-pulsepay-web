const { createId } = require('../utils/id');

class NoticeModel {
  constructor({
    id = createId(),
    title,
    text = '',
    bannerUrl = null,
    isActive = true,
    startsAt = null,
    endsAt = null,
    createdByUserId = null
  }) {
    this.id = id;
    this.title = title;
    this.text = text;
    this.bannerUrl = bannerUrl;
    this.isActive = isActive;
    this.startsAt = startsAt;
    this.endsAt = endsAt;
    this.createdByUserId = createdByUserId;
  }
}

module.exports = NoticeModel;
