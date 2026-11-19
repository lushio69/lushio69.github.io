;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; init-blog-publish.scm : plugin entry (plugins/blog-publish/progs/init-blog-publish.scm)
;; Registers the command module and adds the menu entry under Tools.
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define plugin-blog-root
  (let* ((user (string-append (getenv "TEXMACS_HOME_PATH") "/plugins/blog-publish"))
         (sys (string-append (getenv "TEXMACS_PATH") "/plugins/blog-publish"))
        ) ;
    (if (url-exists? user) user sys)
  ) ;let*
) ;define

(define blog-publish-load-error #f)

(catch #t
  (lambda ()
    (load (url-concretize (string-append plugin-blog-root "/progs/blog-publish-mod.scm")))
  ) ;lambda
  (lambda errs (set! blog-publish-load-error errs))
) ;catch

(menu-bind tools-menu
  (-> "Publish to blog"
   ("Publish current document" (blog-publish-current-buffer))
   ("Export only (no push)" (blog-export-current-buffer))
  ) ;->
) ;menu-bind
