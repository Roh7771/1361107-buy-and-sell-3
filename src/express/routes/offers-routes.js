"use strict";

const {Router} = require(`express`);
const api = require(`../api`).getAPI();
const multer = require(`multer`);
const path = require(`path`);
const {nanoid} = require(`nanoid`);
const {
  catchAsync,
  formatDate,
  getPageList,
  getCardColor,
} = require(`../../utils`);
const idValidator = require(`../middleware/id-validator`);
const {PAGINATION_OFFSET, UPLOAD_DIR} = require(`../../constants`);

const uploadDirAbsolute = path.resolve(__dirname, UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: uploadDirAbsolute,
  filename: (req, file, cb) => {
    const uniqueName = nanoid(10);
    const extension = file.originalname.split(`.`).pop();
    cb(null, `${uniqueName}.${extension}`);
  },
});
const upload = multer({storage});

const offersRouter = new Router();

offersRouter.get(
    `/category/:id`,
    idValidator,
    catchAsync(async (req, res) => {
      const {user} = req.session;
      const page = Number(req.query.page) || 1;
      const {id} = req.params;
      const {count, offers: listOffers} = await api.getOffersByCategory(
          page,
          id
      );
      const categories = await api.getCategories();
      const category = await api.getCategory(id);
      listOffers.forEach((offer) => {
        offer.cardColor = getCardColor();
      });
      const maxPage = Math.ceil(count / PAGINATION_OFFSET);
      const pageList = getPageList(page, maxPage);
      return res.render(`category`, {
        page,
        maxPage,
        pageList,
        listOffers,
        category,
        count,
        categories,
        user,
      });
    })
);

offersRouter.get(
    `/add`,
    catchAsync(async (req, res) => {
      const {user} = req.session;
      const categories = await api.getCategories();
      res.render(`new-ticket`, {
        categories,
        user
      });
    })
);

offersRouter.get(
    `/edit/:id`,
    idValidator,
    catchAsync(async (req, res) => {
      const {user} = req.session;
      const {id} = req.params;
      const [offer, categories] = await Promise.all([
        api.getOffer(id),
        api.getCategories(),
      ]);
      res.render(`ticket-edit`, {offer, categories, user});
    })
);

offersRouter.post(
    `/edit/:id`,
    idValidator,
    upload.single(`picture`),
    catchAsync(async (req, res) => {
      const {id} = req.params;
      const {body, file} = req;
      const offerData = {
        title: body.title,
        description: body.description,
        typeId: body.typeId,
        cost: body.cost,
        categories: body.categories,
      };
      if (typeof offerData.categories === `string`) {
        offerData.categories = [offerData.categories];
      }
      if (body.loadedPicture) {
        offerData.picture = body.loadedPicture;
      }
      if (file) {
        offerData.picture = file.filename;
      }
      try {
        await api.updateOffer(id, offerData);
        res.redirect(`/offers/${id}`);
      } catch (error) {
        const {user} = req.session;
        const {details: errorDetails} = error.response.data.error;
        const [offer, categories] = await Promise.all([
          api.getOffer(id),
          api.getCategories(),
        ]);
        res.render(`ticket-edit`, {
          offer: {
            ...offer,
            ...offerData,
            picture: offerData.picture || offer.picture,
            loadedPicture: file ? file.filename : null,
          },
          categories,
          errorDetails,
          user
        });
      }
    })
);

offersRouter.get(
    `/:id`,
    idValidator,
    catchAsync(async (req, res) => {
      const {user} = req.session;
      const {id} = req.params;
      const itemOffer = await api.getOffer(id);
      res.render(`ticket`, {itemOffer, formatDate, user});
    })
);

offersRouter.post(
    `/:id/comments`,
    idValidator,
    catchAsync(async (req, res) => {
      const {id} = req.params;
      const {body} = req;
      const commentData = {
        userId: 1,
        text: body.text,
      };
      try {
        await api.createComment(id, commentData);
        res.redirect(`/offers/${id}`);
      } catch (error) {
        const {user} = req.session;
        const {details: errorDetails} = error.response.data.error;
        const itemOffer = await api.getOffer(id);
        res.render(`ticket`, {
          itemOffer,
          formatDate,
          prevCommentData: {text: commentData.text},
          errorDetails,
          user
        });
      }
    })
);

offersRouter.post(
    `/add`,
    upload.single(`picture`),
    catchAsync(async (req, res) => {
      const {body, file} = req;
      const offerData = {
        title: body.title,
        description: body.description,
        typeId: body.typeId,
        cost: body.cost,
        picture: file ? file.filename : `item01.jpg`,
        categories: body.categories,
        userId: 1,
      };
      if (typeof offerData.categories === `string`) {
        offerData.categories = [offerData.categories];
      }
      try {
        await api.createOffer(offerData);
        res.redirect(`/my`);
      } catch (error) {
        const {user} = req.session;
        const {details} = error.response.data.error;
        const categories = await api.getCategories();
        res.render(`new-ticket`, {
          categories,
          prevOfferData: offerData,
          errorDetails: details,
          user
        });
      }
    })
);

module.exports = offersRouter;
