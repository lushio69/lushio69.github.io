;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;
;; MODULE      : liii/blog-publish.scm
;; DESCRIPTION : Export a Liii STEM document to the blog Markdown and write it
;;               into content/posts/<slug>.md. Called from the blog-publish plugin.
;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-library (liii blog-publish)
  (import (liii list)
          (scheme base)
          (scheme char)
          (scheme write)
          (liii string)
          (liii path)
          (liii time)
          (liii os)
          (liii json)
  ) ;import
  (export blog-publish-config
          blog-publish-reload-config!
          blog-export-doc!
          blog-export-doc-from-file
          blog-publish-doc!
          blog-file-slug
          blog-markdown
          blog-make
          blog-today
          blog-set-dates!
          blog-take-date
          blog-as-string
          blog-trim
          blog-tags-for
          blog-field
          blog-summary-of
          blog-front-matter
          blog-math-source
          blog-math-tokens
          blog-math-symbol
          blog-math-atom
          blog-math-content
  ) ;export
  (begin
    (define (blog-note tag msg)
      (catch #t
        (lambda ()
          (display tag)
          (display msg)
          (newline)
        ) ;lambda
        (lambda errs "")
      ) ;catch
    ) ;define

    (define (blog-whitespace? c)
      (or (char=? c #\space)
        (char=? c #\tab)
        (char=? c #\newline)
        (char=? c #\return)
      ) ;or
    ) ;define

    (define (blog-trim s)
      (if (not (string? s))
        ""
        (let* ((n (string-length s))
               (start (blog-first-nonspace s 0 n))
               (end (blog-last-nonspace s start n))
              ) ;
          (substring s start end)
        ) ;let*
      ) ;if
    ) ;define

    (define (blog-first-nonspace s i n)
      (cond ((>= i n) n)
            ((blog-whitespace? (string-ref s i)) (blog-first-nonspace s (+ i 1) n))
            (else i)
      ) ;cond
    ) ;define

    (define (blog-last-nonspace s start end)
      (cond ((<= end start) start)
            ((blog-whitespace? (string-ref s (- end 1))) (blog-last-nonspace s start (- end 1)))
            (else end)
      ) ;cond
    ) ;define

    (define (blog-all-blank? s)
      (if (not (string? s))
        #t
        (let loop
          ((i 0))
          (if (>= i (string-length s))
            #t
            (if (blog-whitespace? (string-ref s i)) (loop (+ i 1)) #false)
          ) ;if
        ) ;let
      ) ;if
    ) ;define

    (define (blog-filter pred xs)
      (cond ((null? xs) '())
            ((pred (car xs)) (cons (car xs) (blog-filter pred (cdr xs))))
            (else (blog-filter pred (cdr xs)))
      ) ;cond
    ) ;define

    (define (blog-find pred xs)
      (cond ((null? xs) #false)
            ((pred (car xs)) (car xs))
            (else (blog-find pred (cdr xs)))
      ) ;cond
    ) ;define

    (define (blog-assoc-string key alist)
      (cond ((null? alist) #false)
            ((and (pair? (car alist)) (string=? (car (car alist)) key)) (car alist))
            (else (blog-assoc-string key (cdr alist)))
      ) ;cond
    ) ;define

    (define (blog-join-lines lines)
      (string-join lines "\n")
    ) ;define

    (define (blog-concat xs)
      (cond ((null? xs) "")
            ((string? (car xs)) (string-append (car xs) (blog-concat (cdr xs))))
            ((number? (car xs)) (string-append (number->string (car xs)) (blog-concat (cdr xs))))
            (else (blog-concat (cdr xs)))
      ) ;cond
    ) ;define

    (define (blog-string-has? s c)
      (let loop
        ((i 0))
        (cond ((>= i (string-length s)) #false)
              ((char=? (string-ref s i) c) #t)
              (else (loop (+ i 1)))
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-last xs)
      (if (null? xs) #false (car (reverse xs)))
    ) ;define

    (define (blog-repeat-string s n)
      (if (<= n 0) "" (string-append s (blog-repeat-string s (- n 1))))
    ) ;define

    (define (blog-as-string v)
      (if (string? v)
        v
        (if (symbol? v)
          (symbol->string v)
          (if (number? v) (number->string v) (if v (object->string v) ""))
        ) ;if
      ) ;if
    ) ;define

    ;; ---------------------------------------------------------------------
    ;; equation*/align content is one element (often concat); math nodes are expressions.
    ;; ---------------------------------------------------------------------

    (define blog-config-cache #false)

    (define (blog-config-directory)
      (let ((appdata (getenv "APPDATA" "")))
        (if (or (not appdata) (string-null? appdata))
          (path-join (path (getenv "USERPROFILE" "C:/")) ".blog-publish")
          (path-join (path appdata) "blog-publish")
        ) ;if
      ) ;let
    ) ;define

    (define (blog-config-file)
      (let ((custom (getenv "BLOGPUBLISH_CONFIG" "")))
        (if (and custom (not (string-null? custom)))
          (path custom)
          (path-join (blog-config-directory) "config.json")
        ) ;if
      ) ;let
    ) ;define

    (define (blog-default-config)
      (list (cons "siteDir" "D:/DSH/Workspaces/Projects/lushio69.github.io")
        (cons "postsDir" "content/posts")
        (cons "defaultCategory" "随笔")
        (cons "defaultTags" '())
        (cons "publishScript" "publish.cmd")
        (cons "publishArgs" '())
        (cons "nodeExe" "C:/Program Files/nodejs/node.exe")
      ) ;list
    ) ;define

    (define (blog-merge-config base extra)
      (if (not (pair? extra))
        base
        (let* ((item (car extra)) (key (car item)))
          (blog-merge-config
            (cons (cons key (cdr item))
              (blog-filter (lambda (p) (not (string=? (car p) key))) base)
            ) ;cons
            (cdr extra)
          ) ;blog-merge-config
        ) ;let*
      ) ;if
    ) ;define

    (define (blog-publish-config)
      (if blog-config-cache
        blog-config-cache
        (let* ((file (blog-config-file))
               (extra (if (path-exists? file)
                        (catch #t (lambda () (json-read-file file)) (lambda errs '()))
                        '()
                      ) ;if
               ) ;extra
               (merged (blog-merge-config (blog-default-config) extra))
              ) ;
          (set! blog-config-cache merged)
          merged
        ) ;let*
      ) ;if
    ) ;define

    (define (blog-publish-reload-config!)
      (set! blog-config-cache #false)
      (blog-publish-config)
    ) ;define

    (define (blog-cfg key)
      (let ((cell (blog-assoc-string key (blog-publish-config))))
        (if cell (cdr cell) #false)
      ) ;let
    ) ;define

    (define (blog-category category)
      (let ((c (blog-as-string category)))
        (if (string-null? c) (blog-as-string (blog-cfg "defaultCategory")) c)
      ) ;let
    ) ;define

    ;; ---------------------------------------------------------------------
    ;; equation*/align content is one element (often concat); math nodes are expressions.
    ;; ---------------------------------------------------------------------

    (define (blog-normalize-slashes s)
      (if (string? s) (string-replace (string-replace s "\\" "/") "//" "/") "")
    ) ;define

    (define (blog-strip-leading-dot-slash s)
      (if (string-starts? s "./")
        (blog-strip-leading-dot-slash (substring s 2 (string-length s)))
        s
      ) ;if
    ) ;define

    (define (blog-trim-trailing-slash s)
      (if (and (not (string-null? s))
            (char=? (string-ref s (- (string-length s) 1)) #\/)
          ) ;and
        (blog-trim-trailing-slash (substring s 0 (- (string-length s) 1)))
        s
      ) ;if
    ) ;define

    (define (blog-join base rel)
      (string-append (blog-trim-trailing-slash base)
        "/"
        (blog-strip-leading-dot-slash rel)
      ) ;string-append
    ) ;define

    (define (blog-site-dir)
      (blog-normalize-slashes (blog-as-string (blog-cfg "siteDir")))
    ) ;define

    (define (blog-site-relative dir)
      (let* ((site (blog-site-dir))
             (d (blog-normalize-slashes (blog-as-string dir)))
            ) ;
        (if (string-starts? d site)
          (blog-strip-leading-dot-slash (substring d (string-length site) (string-length d)))
          d
        ) ;if
      ) ;let*
    ) ;define

    (define (blog-as-string-list items)
      (cond ((not items) '())
            ((string? items)
             (blog-filter (lambda (s) (not (string-null? s)))
               (map blog-trim (string-split items ","))
             ) ;blog-filter
            ) ;
            (else
             (let loop
               ((rest items) (out '()))
               (if (null? rest)
                 (reverse out)
                 (let ((s (blog-trim (blog-as-string (car rest)))))
                   (loop (cdr rest)
                     (if (or (string-null? s) (member s out)) out (cons s out))
                   ) ;loop
                 ) ;let
               ) ;if
             ) ;let
            ) ;else
      ) ;cond
    ) ;define

    ;; ---------------------------------------------------------------------
    ;; equation*/align content is one element (often concat); math nodes are expressions.
    ;; ---------------------------------------------------------------------

    (define (blog-strip-trailing-dash s)
      (if (and (not (string-null? s))
            (char=? (string-ref s (- (string-length s) 1)) #\-)
          ) ;and
        (blog-strip-trailing-dash (substring s 0 (- (string-length s) 1)))
        s
      ) ;if
    ) ;define

    (define (blog-slugify text . fallback)
      (let* ((s (if (string? text) text ""))
             (fb (if (null? fallback) "post" (car fallback)))
            ) ;
        (let loop
          ((i 0) (out "") (dash? #t))
          (if (>= i (string-length s))
            (let ((t (blog-strip-trailing-dash out)))
              (if (string-null? t) fb t)
            ) ;let
            (let ((c (string-ref s i)))
              (if (or (char-alphabetic? c)
                    (char-numeric? c)
                    (and (> (char->integer c) 127) (not (char-whitespace? c)))
                  ) ;or
                (loop (+ i 1) (string-append out (string (char-downcase c))) #false)
                (loop (+ i 1) (if dash? out (string-append out "-")) #t)
              ) ;if
            ) ;let
          ) ;if
        ) ;let
      ) ;let*
    ) ;define

    (define blog-date-stamp "2026-01-01 00:00")

    (define (blog-set-dates! stamp)
      (set! blog-date-stamp (blog-as-string stamp))
      blog-date-stamp
    ) ;define

    (define (blog-today)
      (blog-take-date blog-date-stamp)
    ) ;define

    (define (blog-take-date s)
      (cond ((not (string? s)) "")
            ((< (string-length s) 10) s)
            (else (substring s 0 10))
      ) ;cond
    ) ;define

    (define (blog-stem-path file)
      (let* ((f (blog-normalize-slashes (blog-as-string file)))
             (name (blog-last (string-split f "/")))
             (suffix (if name (path-suffix (path (blog-join "x" name))) ""))
            ) ;
        (if (and (string? suffix) (not (string-null? suffix)))
          (blog-join (substring f 0 (- (string-length f) (string-length suffix))) ".stem")
          (blog-join f ".stem")
        ) ;if
      ) ;let*
    ) ;define

    (define (blog-file-slug file-path docs-dir)
      (let* ((name (path-stem (path (blog-normalize-slashes (blog-as-string file-path)))))
             (ws (let ((d (blog-normalize-slashes (blog-site-relative docs-dir))))
                   (if (or (string-null? d) (string=? d "."))
                     ""
                     (blog-slugify (blog-last (string-split d "/")) "")
                   ) ;if
                 ) ;let
            ) ;
            ) ;
        (if (and (not (string-null? ws)) (not (string-starts? name ws)))
          (blog-slugify (blog-join ws name) "post")
          (blog-slugify name "post")
        ) ;if
      ) ;let*
    ) ;define

    (define (blog-unique-slug dir slug)
      (let loop
        ((n 1))
        (let* ((candidate (if (= n 1) slug (string-append slug "-" (number->string n))))
               (md (path-join (path dir) (string-append candidate ".md")))
               (sub (path-join (path dir) candidate))
              ) ;
          (cond ((path-exists? md) (loop (+ n 1)))
                ((path-exists? sub) (loop (+ n 1)))
                (else candidate)
          ) ;cond
        ) ;let*
      ) ;let
    ) ;define

    (define (blog-head-name head)
      (cond ((symbol? head) (symbol->string head))
            ((string? head) head)
            (else "")
      ) ;cond
    ) ;define

    (define (blog-list-container? head)
      (let ((name (blog-head-name head)))
        (cond ((string=? name "") #false)
              ((string=? name "itemize") #true)
              ((string=? name "itemize*") #true)
              ((string=? name "enumerate") #true)
              ((string=? name "enumerate*") #true)
              ((string=? name "itemized-list") #true)
              ((string=? name "enumerated-list") #true)
              ((string=? name "description") #true)
              (else #false)
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-node-list? node)
      (cond ((null? node) #false)
            ((and (pair? (car node)) (blog-list-container? (car (car node)))) #t)
            ((and (pair? (car node)) (eq? (car (car node)) 'document))
             (blog-node-list? (cdr node))
            ) ;
            ((and (string? (car node)) (blog-all-blank? (car node)))
             (blog-node-list? (cdr node))
            ) ;
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-heading-level head)
      (cond ((or (eq? head 'chapter) (eq? head 'chapter*)) 1)
            ((or (eq? head 'section) (eq? head 'section*)) 2)
            ((or (eq? head 'subsection) (eq? head 'subsection*)) 3)
            ((or (eq? head 'subsubsection) (eq? head 'subsubsection*)) 4)
            ((or (eq? head 'paragraph) (eq? head 'paragraph*)) 5)
            ((or (eq? head 'subparagraph) (eq? head 'subparagraph*)) 6)
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-code-head? head)
      (let ((name (blog-head-name head)))
        (or (string=? name "python-code")
          (string=? name "cpp-code")
          (string=? name "c-code")
          (string=? name "java-code")
          (string=? name "bash-code")
          (string=? name "shell-code")
          (string=? name "scm-code")
          (string=? name "mmx-code")
          (string=? name "scilab-code")
          (string=? name "julia-code")
          (string=? name "lua-code")
          (string=? name "javascript-code")
          (string=? name "java-script-code")
          (string=? name "code")
          (string=? name "verbatim-code")
          (string=? name "verbatim")
        ) ;or
      ) ;let
    ) ;define

    (define (blog-code-language head)
      (cond ((eq? head 'python-code) "python")
            ((or (eq? head 'cpp-code) (eq? head 'c-code)) "cpp")
            ((eq? head 'java-code) "java")
            ((or (eq? head 'bash-code) (eq? head 'shell-code)) "bash")
            ((eq? head 'scm-code) "scheme")
            ((eq? head 'mmx-code) "mmx")
            ((eq? head 'scilab-code) "scilab")
            ((eq? head 'julia-code) "julia")
            ((eq? head 'lua-code) "lua")
            ((or (eq? head 'javascript-code) (eq? head 'java-script-code))
             "javascript"
            ) ;
            (else "")
      ) ;cond
    ) ;define

    ;; ---------------------------------------------------------------------
    ;; equation*/align content is one element (often concat); math nodes are expressions.
    ;; ---------------------------------------------------------------------

    (define (blog-normalize-space s)
      (if (not (string? s))
        ""
        (let loop
          ((i 0) (out "") (space? #false))
          (if (>= i (string-length s))
            out
            (let ((c (string-ref s i)))
              (if (blog-whitespace? c)
                (loop (+ i 1) out #t)
                (loop (+ i 1)
                  (if space? (string-append out " " (string c)) (string-append out (string c)))
                  #false
                ) ;loop
              ) ;if
            ) ;let
          ) ;if
        ) ;let
      ) ;if
    ) ;define

    (define (blog-wrap prefix suffix s)
      (if (string-null? s) s (string-append prefix s suffix))
    ) ;define

    (define (blog-join-piece out piece space?)
      (if (string-null? piece) out (string-append out (if space? " " "") piece))
    ) ;define

    (define (blog-math-symbol name)
      (cond ((string=? name "alpha") "\\alpha")
            ((string=? name "beta") "\\beta")
            ((string=? name "gamma") "\\gamma")
            ((string=? name "delta") "\\delta")
            ((string=? name "epsilon") "\\epsilon")
            ((string=? name "varepsilon") "\\varepsilon")
            ((string=? name "zeta") "\\zeta")
            ((string=? name "eta") "\\eta")
            ((string=? name "theta") "\\theta")
            ((string=? name "iota") "\\iota")
            ((string=? name "kappa") "\\kappa")
            ((string=? name "lambda") "\\lambda")
            ((string=? name "mu") "\\mu")
            ((string=? name "nu") "\\nu")
            ((string=? name "xi") "\\xi")
            ((string=? name "pi") "\\pi")
            ((string=? name "rho") "\\rho")
            ((string=? name "sigma") "\\sigma")
            ((string=? name "tau") "\\tau")
            ((string=? name "upsilon") "\\upsilon")
            ((string=? name "phi") "\\phi")
            ((string=? name "varphi") "\\varphi")
            ((string=? name "chi") "\\chi")
            ((string=? name "psi") "\\psi")
            ((string=? name "omega") "\\omega")
            ((string=? name "Gamma") "\\Gamma")
            ((string=? name "Delta") "\\Delta")
            ((string=? name "Theta") "\\Theta")
            ((string=? name "Lambda") "\\Lambda")
            ((string=? name "Xi") "\\Xi")
            ((string=? name "Pi") "\\Pi")
            ((string=? name "Sigma") "\\Sigma")
            ((string=? name "Phi") "\\Phi")
            ((string=? name "Psi") "\\Psi")
            ((string=? name "Omega") "\\Omega")
            ((string=? name "infty") "\\infty")
            ((string=? name "partial") "\\partial")
            ((string=? name "nabla") "\\nabla")
            ((string=? name "rightarrow") "\\to")
            ((string=? name "to") "\\to")
            ((string=? name "leftarrow") "\\leftarrow")
            ((string=? name "Rightarrow") "\\Rightarrow")
            ((string=? name "Leftarrow") "\\Leftarrow")
            ((string=? name "Leftrightarrow") "\\Leftrightarrow")
            ((string=? name "rightarrow") "\\rightarrow")
            ((string=? name "uparrow") "\\uparrow")
            ((string=? name "geq") "\\geq")
            ((string=? name "leq") "\\leq")
            ((string=? name "geqslant") "\\geqslant")
            ((string=? name "leqslant") "\\leqslant")
            ((string=? name "neq") "\\neq")
            ((string=? name "approx") "\\approx")
            ((string=? name "equiv") "\\equiv")
            ((string=? name "sim") "\\sim")
            ((string=? name "propto") "\\propto")
            ((string=? name "in") "\\in")
            ((string=? name "notin") "\\notin")
            ((string=? name "subset") "\\subset")
            ((string=? name "subseteq") "\\subseteq")
            ((string=? name "supset") "\\supset")
            ((string=? name "cup") "\\cup")
            ((string=? name "cap") "\\cap")
            ((string=? name "emptyset") "\\emptyset")
            ((string=? name "forall") "\\forall")
            ((string=? name "exists") "\\exists")
            ((string=? name "neg") "\\neg")
            ((string=? name "wedge") "\\wedge")
            ((string=? name "vee") "\\vee")
            ((string=? name "pm") "\\pm")
            ((string=? name "mp") "\\mp")
            ((string=? name "times") "\\times")
            ((string=? name "cdot") "\\cdot")
            ((string=? name "div") "\\div")
            ((string=? name "ast") "\\ast")
            ((string=? name "cdots") "\\cdots")
            ((string=? name "ldots") "\\ldots")
            ((string=? name "dots") "\\dots")
            ((string=? name "vdots") "\\vdots")
            ((string=? name "ddots") "\\ddots")
            ((string=? name "prime") "'")
            ((string=? name "circ") "\\circ")
            ((string=? name "degree") "^{\\circ}")
            ((string=? name "angle") "\\angle")
            ((string=? name "triangle") "\\triangle")
            ((string=? name "perp") "\\perp")
            ((string=? name "parallel") "\\parallel")
            ((string=? name "sum") "\\sum")
            ((string=? name "prod") "\\prod")
            ((string=? name "int") "\\int")
            ((string=? name "iint") "\\iint")
            ((string=? name "oint") "\\oint")
            ((string=? name "lim") "\\lim")
            ((string=? name "max") "\\max")
            ((string=? name "min") "\\min")
            ((string=? name "det") "\\det")
            ((string=? name "sin") "\\sin")
            ((string=? name "cos") "\\cos")
            ((string=? name "tan") "\\tan")
            ((string=? name "cot") "\\cot")
            ((string=? name "sec") "\\sec")
            ((string=? name "csc") "\\csc")
            ((string=? name "arcsin") "\\arcsin")
            ((string=? name "arccos") "\\arccos")
            ((string=? name "arctan") "\\arctan")
            ((string=? name "sinh") "\\sinh")
            ((string=? name "cosh") "\\cosh")
            ((string=? name "tanh") "\\tanh")
            ((string=? name "exp") "\\exp")
            ((string=? name "ln") "\\ln")
            ((string=? name "lg") "\\lg")
            ((string=? name "log") "\\log")
            ((string=? name "gcd") "\\gcd")
            ((string=? name "leqslant") "\\leqslant")
            ((string=? name "ell") "\\ell")
            ((string=? name "hbar") "\\hbar")
            ((string=? name "Re") "\\Re")
            ((string=? name "Im") "\\Im")
            ((string=? name "mid") "\\mid")
            ((string=? name "vert") "|")
            ((string=? name "Vert") "\\Vert")
            ((string=? name "langle") "\\langle")
            ((string=? name "rangle") "\\rangle")
            ((string=? name "lfloor") "\\lfloor")
            ((string=? name "rfloor") "\\rfloor")
            ((string=? name "lceil") "\\lceil")
            ((string=? name "rceil") "\\rceil")
            ((string=? name "ldots-low") "\\ldots")
            (else
             (let ((chars (string->list name)))
               (cond ((null? chars) "")
                     ((and (null? (cdr chars)) (char-alphabetic? (car chars))) name)
                     ((and (null? (cdr chars)) (char-numeric? (car chars))) name)
                     (else (string-append "\\mathrm{" name "}"))
               ) ;cond
             ) ;let
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-raw x)
      (cond ((string? x) x)
            ((symbol? x) (blog-math-symbol (symbol->string x)))
            ((number? x) (number->string x))
            (else "")
      ) ;cond
    ) ;define

    (define (blog-take-upto xs n)
      (cond ((<= n 0) '())
            ((null? xs) '())
            (else (cons (car xs) (blog-take-upto (cdr xs) (- n 1))))
      ) ;cond
    ) ;define

    (define (blog-drop-upto xs n)
      (cond ((<= n 0) xs)
            ((null? xs) '())
            (else (blog-drop-upto (cdr xs) (- n 1)))
      ) ;cond
    ) ;define

        (define (blog-math-tokens node)
      (cond ((not (pair? node)) "")
            ((blog-head-is? (car node) "rsup")
             (string-append "^{" (blog-math-seq (cdr node)) "}")
            ) ;
            ((blog-head-is? (car node) "rsub")
             (string-append "_{" (blog-math-seq (cdr node)) "}")
            ) ;
            ((blog-head-is? (car node) "bsup")
             (string-append "^{" (blog-math-seq (cdr node)) "}")
            ) ;
            ((blog-head-is? (car node) "bsub")
             (string-append "_{" (blog-math-seq (cdr node)) "}")
            ) ;
            ((blog-head-is? (car node) "frac")
             (string-append "\\frac{"
               (blog-math-seq (blog-take-upto (cdr node) 1))
               "}{"
               (blog-math-seq (blog-drop-upto (cdr node) 1))
               "}"
             ) ;string-append
            ) ;
            ((blog-head-is? (car node) "sqrt")
             (string-append "\\sqrt{" (blog-math-seq (cdr node)) "}")
            ) ;
            ((blog-head-is? (car node) "big")
             (blog-math-atom (blog-last node))
            ) ;
            ((blog-head-is? (car node) "text")
             (string-append "\\text{" (blog-flatten node) "}")
            ) ;
            ((blog-head-is? (car node) "concat")
             (blog-math-seq (cdr node))
            ) ;
            ((blog-head-is? (car node) "document")
             (blog-math-seq (cdr node))
            ) ;
            (else (blog-math-seq (cdr node)))
      ) ;cond
    ) ;define

    (define (blog-math-seq items)
      (let loop ((rest items) (acc ""))
        (cond ((null? rest) acc)
              (else (loop (cdr rest) (string-append acc (blog-math-atom (car rest))))
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-math-atom item)
      (cond ((string? item) item)
            ((symbol? item) (blog-math-symbol (symbol->string item)))
            ((number? item) (number->string item))
            ((not (pair? item)) "")
            ((blog-head-is? (car item) "concat") (blog-math-seq (cdr item)))
            ((blog-head-is? (car item) "big")
             (blog-math-atom (blog-last item))
            ) ;
            (else (blog-math-tokens item))
      ) ;cond
    ) ;define

    (define (blog-math-content node)
      (cond ((not (pair? node)) "")
            ((blog-head-is? (car node) "document") (blog-math-content (blog-last node)))
            ((memq (car node) (quote (equation* eqnarray* align))) (blog-math-content (blog-last node)))
            (else node)
      ) ;cond
    ) ;define

        (define (blog-math-source node)
      (let* ((body (blog-math-content node))
             (fallback (blog-math-tokens body))
             (latex (catch #t
                      (lambda ()
                        (if (defined? 'texmacs->latex)
                          (let ((l (texmacs->latex (stree->tree node) '())))
                            (if (string? l) (blog-trim l) #false)
                          ) ;let
                          #false
                        ) ;if
                      ) ;lambda
                      (lambda errs #false)
                    ) ;catch
                  ) ;
            ) ;
        (cond ((not latex) fallback)
              ((string-null? latex) fallback)
              (else latex)
        ) ;cond
      ) ;let*
    ) ;define

    (define (blog-image-source node)
      (let ((arg (if (pair? (cdr node)) (cadr node) #false)))
        (cond ((not (pair? arg)) "")
              (else
               (string-append "![](" (blog-as-string (car arg)) ")")
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

        (define (blog-inline xs)
      (let loop
        ((rest xs) (out "") (space? #false))
        (cond ((null? rest) (blog-trim out))
              ((string? (car rest))
               (let ((s (blog-normalize-space (car rest))))
                 (if (string-null? s)
                   (loop (cdr rest) out #t)
                   (let ((ended (blog-whitespace? (string-ref s (- (string-length s) 1)))))
                     (loop (cdr rest) (string-append out (if space? " " "") s) ended)
                   ) ;let
                 ) ;if
               ) ;let
              ) ;
              ((not (pair? (car rest))) (loop (cdr rest) out space?))
              ((memq (car (car rest))
                 (list 'itemize 'itemize* 'enumerate 'enumerate* 'itemized-list
                   'enumerated-list 'description
                 ) ;list
               ) ;memq
               (loop (cdr rest) (blog-join-piece out (blog-emit-list (car rest)) space?) #t)
              ) ;
              (else
               (let ((piece (blog-inline-node (car rest))))
                 (loop (cdr rest) (blog-join-piece out piece space?) #false)
               ) ;let
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-math->latex math-st)
      (catch #t
        (lambda () (texmacs->latex (stree->tree math-st) '()))
        (lambda errs #false)
      ) ;catch
    ) ;define

    (define (blog-math-text node body)
      (let ((latex (blog-math->latex node)))
        (if (string? latex) (blog-trim latex) (blog-inline body))
      ) ;let
    ) ;define

    (define (blog-encode-src s)
      (let loop
        ((i 0) (out ""))
        (if (>= i (string-length s))
          out
          (let ((c (string-ref s i)))
            (loop (+ i 1)
              (cond ((char=? c #\space) (string-append out "%20"))
                    ((char=? c #\%) (string-append out "%25"))
                    (else (string-append out (string c)))
              ) ;cond
            ) ;loop
          ) ;let
        ) ;if
      ) ;let
    ) ;define

    (define (blog-image->markdown node)
      (let* ((raw (if (pair? (cdr node)) (blog-inline (cdr node)) ""))
             (src (cond ((string-starts? raw "\\")
                         (let ((l (blog-math->latex (list 'math raw))))
                           (if (string? l) (blog-trim l) raw)
                         ) ;let
                        ) ;
                        (else raw)
                       ) ;
             ) ;
            ) ;
        (if (string-null? src)
          ""
          (string-append "![](" (blog-encode-src src) ")")
        ) ;if
      ) ;let*
    ) ;define

    (define (blog-hlink->markdown node)
      (let* ((label (blog-inline (list (cadr node))))
             (url (blog-inline (list (blog-last node))))
             (url (if (string-starts? url "\\")
                    (let ((l (blog-math->latex (list 'math url))))
                      (if (string? l) (blog-trim l) url)
                    ) ;let
                    url
                  ) ;if
             ) ;
            ) ;
        (if (string-null? label) url (string-append "[" label "](" url ")"))
      ) ;let*
    ) ;define

    (define (blog-code-span node)
      (let ((s (blog-inline (cdr node))))
        (if (blog-string-has? s (integer->char 96))
          (blog-wrap "<code>" "</code>" s)
          (blog-wrap "`" "`" s)
        ) ;if
      ) ;let
    ) ;define

    (define (blog-frac node)
      (let ((a (if (pair? (cdr node)) (blog-inline (list (cadr node))) ""))
            (b (if (and (pair? (cdr node)) (pair? (cddr node)))
                 (blog-inline (list (car (cddr node))))
                 ""
               ) ;if
            ) ;
           ) ;
        (string-append "\\frac{" a "}{" b "}")
      ) ;let
    ) ;define

    (define (blog-name? head name)
      (cond ((symbol? head) (string=? (symbol->string head) name))
            ((string? head) (string=? head name))
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-name-in? head names)
      (cond ((symbol? head) (member (symbol->string head) names) #true)
            ((string? head) (member head names) #true)
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-head-is? head name)
      (cond ((symbol? head) (string=? (symbol->string head) name))
            ((string? head) (string=? head name))
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-head-one-of? head names)
      (cond ((symbol? head) (if (member (symbol->string head) names) #true #false))
            ((string? head) (if (member head names) #true #false))
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-wrap-math latex)
      (cond ((string-null? latex) "")
            (else (string-append " $" latex "$"))
      ) ;cond
    ) ;define

    (define (blog-inline-node node)
      (let ((head (if (pair? node) (car node) #false)))
        (cond ((blog-head-is? head "concat") (blog-inline (cdr node)))
              ((blog-head-is? head "text")
               (blog-normalize-space (blog-inline (cdr node)))
              ) ;
              ((blog-head-one-of? head (list "math" "equation"))
               (let ((latex (blog-math-source node)))
                 (cond ((string-null? latex) "")
                       ((string-starts? latex "\\begin{aligned}")
                        (string-append "$$" latex "$$")
                       ) ;
                       (else (blog-wrap-math latex))
                 ) ;cond
               ) ;let
              ) ;
              ((blog-head-is? head "equation*")
               (string-append "$$" (blog-math-source node) "$$")
              ) ;
              ((blog-head-is? head "rsup")
               (string-append "^{" (blog-inline (cdr node)) "}")
              ) ;
              ((blog-head-is? head "rsub")
               (string-append "_{" (blog-inline (cdr node)) "}")
              ) ;
              ((blog-head-is? head "frac")
               (string-append "\\frac{" (blog-inline (list (cadr node))) "}{"
                 (let ((rest (cddr node)))
                   (if (pair? rest) (blog-inline (list (car rest))) "")) ;let
                 "}"
               ) ;string-append
              ) ;
              ((blog-head-is? head "sqrt")
               (string-append "\\sqrt{" (blog-inline (cdr node)) "}")
              ) ;
              ((blog-head-is? head "with")
               (blog-inline (list (blog-last node)))
              ) ;
              ((blog-head-is? head "hlink")
               (let ((label (blog-inline (list (cadr node))))
                     (url (blog-inline (list (blog-last node)))))
                 (cond ((string-null? label) url)
                       (else (string-append "[" label "](" url ")"))
                 ) ;cond
               ) ;let
              ) ;
              ((blog-head-one-of? head (list "strong" "bold"))
               (blog-wrap "**" "**" (blog-inline (cdr node)))
              ) ;
              ((blog-head-one-of? head (list "em" "dfn" "italic"))
               (blog-wrap "*" "*" (blog-inline (cdr node)))
              ) ;
              ((blog-head-is? head "underline")
               (blog-wrap "<u>" "</u>" (blog-inline (cdr node)))
              ) ;
              ((blog-head-is? head "strike-through")
               (blog-wrap "~~" "~~" (blog-inline (cdr node)))
              ) ;
              ((blog-head-one-of? head (list "code" "verbatim" "samp" "kbd" "pre"))
               (let ((s (blog-inline (cdr node))))
                 (if (blog-string-has? s (integer->char 96))
                   (blog-wrap "<code>" "</code>" s)
                   (blog-wrap "`" "`" s)
                 ) ;if
               ) ;let
              ) ;
              ((blog-head-is? head "sub")
               (blog-wrap "<sub>" "</sub>" (blog-inline (cdr node)))
              ) ;
              ((blog-head-is? head "sup")
               (blog-wrap "<sup>" "</sup>" (blog-inline (cdr node)))
              ) ;
              ((blog-head-one-of? head (list "nbsp" "hspace" "space")) " ")
              ((blog-head-one-of? head (list "label" "tag" "footnote")) "")
              ((blog-head-one-of? head (list "var" "var-math" "rm"))
               (blog-inline (cdr node))
              ) ;
              ((blog-head-is? head "image") (blog-image-source node))
              ((blog-head-is? head "item")
               (blog-inline (list (blog-last node)))
              ) ;
              (else (blog-inline (cdr node)))
        ) ;cond
      ) ;let
    ) ;define

        ;; ---------------------------------------------------------------------
    ;; equation*/align content is one element (often concat); math nodes are expressions.
    ;; ---------------------------------------------------------------------

    (define (blog-flatten node)
      (cond ((string? node) node)
            ((number? node) (number->string node))
            ((not (pair? node)) "")
            (else (blog-concat (map blog-flatten (cdr node))))
      ) ;cond
    ) ;define

    (define (blog-drop-leading-blank-lines lines)
      (cond ((null? lines) '())
            ((blog-all-blank? (car lines))
             (blog-drop-leading-blank-lines (cdr lines))
            ) ;
            (else lines)
      ) ;cond
    ) ;define

    (define (blog-line-indent line)
      (let loop
        ((i 0))
        (if (and (< i (string-length line)) (char=? (string-ref line i) #\space))
          (loop (+ i 1))
          i
        ) ;if
      ) ;let
    ) ;define

    (define (blog-min-indent lines)
      (let loop
        ((rest lines) (best #false))
        (cond ((null? rest) (if best best 0))
              ((blog-all-blank? (car rest)) (loop (cdr rest) best))
              (else
               (let ((k (blog-line-indent (car rest))))
                 (loop (cdr rest) (if (or (not best) (< k best)) k best))
               ) ;let
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-strip-indent line n)
      (let ((k (blog-line-indent line)))
        (if (>= k n) (substring line n (string-length line)) line)
      ) ;let
    ) ;define

    (define (blog-code-block head node)
      (let* ((lang (blog-code-language head))
             (flat (blog-flatten node))
             (lines (string-split (string-replace flat "\r" "") "\n"))
             (lines (reverse
                      (blog-drop-leading-blank-lines
                        (reverse (blog-drop-leading-blank-lines lines))
                      ) ;blog-drop-leading-blank-lines
                    ) ;reverse
             ) ;
             (n (blog-min-indent lines))
             (body (blog-join-lines
                     (map (lambda (l) (blog-strip-indent l n)) lines)
                   ) ;blog-join-lines
             ) ;
            ) ;
        (string-append "```" lang "\n" body "\n```")
      ) ;let*
    ) ;define

    ;; find helpers: collect all nodes then linear search (s7 let/cond recursion is unreliable)
    (define (blog-find-deep pred node)
      (blog-find-marker node)
    ) ;define

    (define (blog-find-marker node)
      (cond ((and (pair? node) (blog-body-key? (car node))) node)
            ((not (pair? node)) #false)
            (else (blog-find-marker-in (cdr node)))
      ) ;cond
    ) ;define

    (define (blog-find-marker-in children)
      (cond ((null? children) #false)
            (else (let ((found (blog-find-marker (car children))))
                    (cond (found found)
                          (else (blog-find-marker-in (cdr children)))
                    ) ;cond
                  ) ;let
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-first-hit pred candidates)
      (cond ((null? candidates) #false)
            ((pred (car candidates)) (car candidates))
            (else (blog-first-hit pred (cdr candidates)))
      ) ;cond
    ) ;define

    (define (blog-head? node head)
      (and (pair? node) (eq? (car node) head))
    ) ;define

    (define (blog-cell->text cell)
      (if (and (pair? cell) (eq? (car cell) 'cell))
        (blog-inline (cdr cell))
        (blog-inline (list cell))
      ) ;if
    ) ;define

    (define (blog-cell-align cell)
      (if (and (pair? cell) (pair? (cdr cell)))
        (let ((h (blog-as-string (cadr cell))))
          (cond ((string=? h "l") ":---")
                ((string=? h "c") ":---:")
                ((string=? h "r") "---:")
                (else "---")
          ) ;cond
        ) ;let
        "---"
      ) ;if
    ) ;define

    (define (blog-pad-row row width)
      (append row
        (let loop
          ((k (- width (length row))) (out '()))
          (if (<= k 0) out (loop (- k 1) (cons "" out)))
        ) ;let
      ) ;append
    ) ;define

    (define (blog-table-row->line row)
      (string-append "| "
        (string-join (map (lambda (c) (string-replace c "|" "\\|")) row)
          " | "
        ) ;string-join
        " |"
      ) ;string-append
    ) ;define

    (define (blog-table->markdown table)
      (let ((rows (blog-table-rows (list table))))
        (cond ((null? rows) "")
              (else
               (let* ((cells (map (lambda (r) (map blog-cell->text (cdr r))) rows))
                      (width (blog-max-length cells))
                      (padded (map (lambda (r) (blog-pad-row r width)) cells))
                     ) ;
                 (blog-join-lines
                   (cons (blog-table-line (car padded))
                     (cons (blog-table-sep-line (length (car padded)))
                       (map blog-table-line (cdr padded))
                     ) ;cons
                   ) ;blog-join-lines
                 ) ;cons
               ) ;let*
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-max-length rows)
      (cond ((null? rows) 0)
            ((< (blog-max-length (cdr rows)) (length (car rows))) (length (car rows)))
            (else (blog-max-length (cdr rows)))
      ) ;cond
    ) ;define

    (define (blog-table-rows nodes)
      (cond ((null? nodes) '())
            (else
             (append
               (if (and (pair? (car nodes)) (blog-head-is? (car (car nodes)) "row"))
                 (list (car nodes))
                 (let ((inner (if (pair? (car nodes)) (cdr (car nodes)) '())))
                   (blog-table-rows inner)
                 ) ;let
               ) ;if
               (blog-table-rows (cdr nodes))
             ) ;append
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-table-line row)
      (string-append "| "
        (string-join (map (lambda (c) (string-replace c "|" "\\|")) row) " | ")
        " |"
      ) ;string-append
    ) ;define

    (define (blog-table-sep-line n)
      (string-append "|" (blog-repeat-string " --- |" n))
    ) ;define

    (define (blog-quote-block text)
      (blog-join-lines
        (map (lambda (l) (string-append "> " l)) (string-split text "\n"))
      ) ;blog-join-lines
    ) ;define

    (define (blog-join-blocks blocks)
      (if (null? blocks)
        ""
        (let loop
          ((rest (cdr blocks)) (out (car blocks)))
          (if (null? rest)
            out
            (loop (cdr rest) (string-append out "\n\n" (car rest)))
          ) ;if
        ) ;let
      ) ;if
    ) ;define

    (define (blog-blocks-of body)
      (blog-join-blocks
        (blog-filter (lambda (b) (and (string? b) (not (string=? b ""))))
          (map blog-emit-node body)
        ) ;blog-filter
      ) ;blog-join-blocks
    ) ;define

    (define (blog-list-items body)
      (let loop
        ((rest body) (current '()) (items '()))
        (cond ((null? rest)
               (reverse (if (null? current) items (cons (reverse current) items)))
              ) ;
              ((and (string? (car rest))
                    (string=? (blog-trim (car rest)) "\\item")
                ) ;and
               (loop (cdr rest) '() (cons (reverse current) items))
              ) ;
              (else (loop (cdr rest) (cons (car rest) current) items))
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-list-item->markdown body)
      (let loop
        ((rest body) (out "•") (space? #t))
        (cond ((null? rest) out)
              ((string? (car rest))
               (let ((s (blog-normalize-space (car rest))))
                 (if (string-null? s)
                   (loop (cdr rest) out space?)
                   (loop (cdr rest)
                     (string-append out s)
                     (blog-whitespace? (string-ref s (- (string-length s) 1)))
                   ) ;loop
                 ) ;if
               ) ;let
              ) ;
              (else
               (let ((piece (blog-emit-node (car rest))))
                 (if (string=? piece "")
                   (loop (cdr rest) out space?)
                   (loop (cdr rest) (string-append out "\n\n" piece) #false)
                 ) ;if
               ) ;let
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-emit-list node)
      (let ((flat (blog-flatten node)))
        (blog-items->markdown (blog-split-items flat))
      ) ;let
    ) ;define

    (define (blog-split-items flat)
      (blog-split-items-in (blog-normalize-item-markers flat))
    ) ;define

    ;; equation*/align content is one element (often concat); math nodes are expressions.
    (define (blog-normalize-item-markers flat)
      (string-replace flat (string #\\ #\i #\t #\e #\m) "item")
    ) ;define

    (define (blog-split-items-in flat)
      (let ((parts (string-split flat "item")))
        (cond ((null? parts) '())
              ((string-null? (blog-trim (car parts))) (cdr parts))
              (else parts)
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-items->markdown items)
      (blog-join-lines (map blog-item-line items))
    ) ;define

    (define (blog-item-line item)
      (let ((text (blog-trim (blog-normalize-space item))))
        (cond ((string-null? text) "-")
              (else (string-append "- " text))
        ) ;cond
      ) ;let
    ) ;define

        (define (blog-captions-text node)
      (let ((cap (blog-find (lambda (n) (and (pair? n)
                                            (memq (car n) (list 'captions-long 'captions-short))
                                          ) ;and
                            ) ;lambda
                   (if (pair? (cdr node)) (cdr node) '())
                 ) ;blog-find
                 ) ;
            ) ;
        (if cap (blog-inline (cdr cap)) "")
      ) ;let
    ) ;define

    (define (blog-figure->markdown node)
      (let* ((img (blog-first-of (blog-find-name node "image")))
             (caption (blog-captions-text node))
            ) ;
        (cond ((not img) "")
              ((string-null? caption) (blog-image-source img))
              (else
               (string-append (blog-image-source img) "\n\n*" caption "*")
              ) ;else
        ) ;cond
      ) ;let*
    ) ;define

    (define (blog-find-name node name)
      (cond ((not (pair? node)) '())
            ((and (symbol? (car node)) (string=? (symbol->string (car node)) name))
             (list node)
            ) ;
            (else (blog-find-name-c (cdr node) name))
      ) ;cond
    ) ;define

    (define (blog-find-name-c children name)
      (cond ((null? children) '())
            (else
             (let ((found (blog-find-name (car children) name)))
               (cond ((pair? found) found)
                     (else (blog-find-name-c (cdr children) name))
               ) ;cond
             ) ;let
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-first-of found)
      (cond ((null? found) #false) (else (car found)))
    ) ;define

        (define (blog-block-node? node)
      (cond ((not (pair? node)) #false)
            ((blog-heading-level (car node)) #t)
            ((memq (car node)
               (list 'equation* 'eqnarray* 'align 'table 'tformat 'block
                 'block* 'wide-block 'quote-env 'quote 'big-figure
                 'small-figure 'figure 'image 'document
               ) ;list
             ) ;memq
             #t
            ) ;
            ((blog-code-head? (car node)) #t)
            ((blog-list-container? (car node)) #t)
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-list-contains? xs)
      (cond ((null? xs) #false)
            ((and (pair? (car xs)) (blog-list-container? (car (car xs)))) #t)
            ((and (pair? (car xs)) (pair? (car (car xs)))
               (blog-list-contains? (cdr (car xs)))
             ) ;and
             #t
            ) ;
            (else (blog-list-contains? (cdr xs)))
      ) ;cond
    ) ;define

    (define (blog-document->markdown doc-node)
      (blog-blocks-of (cdr doc-node))
    ) ;define

    (define (blog-first-block-index nodes)
      (cond ((null? nodes) #f)
            ((blog-strong-block? (car nodes)) 0)
            (else
             (let ((rest (blog-first-block-index (cdr nodes))))
               (if rest (+ rest 1) #false)
             ) ;let
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-strong-block? node)
      (cond ((not (pair? node)) #false)
            (else
             (let ((head (car node)))
               (cond ((blog-head-name-in? head
                        (list "chapter" "chapter*" "section" "section*"
                          "subsection" "subsection*" "paragraph" "equation*"
                          "align" "itemize" "enumerate" "picture" "table"
                          "tformat" "block"
                        ) ;list
                      ) ;blog-head-name-in?
                      #true
                     ) ;
                     ((blog-code-head? head) #true)
                     (else #false)
               ) ;cond
             ) ;let
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-head-name-in? head names)
      (cond ((symbol? head) (if (member (symbol->string head) names) #true #false))
            ((string? head) (if (member head names) #true #false))
            (else #false)
      ) ;cond
    ) ;define

    (define (blog-emit-mixed nodes)
      (let ((split (blog-first-block-index nodes)))
        (cond ((not split) (blog-inline nodes))
              (else
               (blog-blocks-of
                 (append
                   (if (= split 0) '() (list (list 'concat (blog-inline (blog-take nodes split)))))
                   (list-tail nodes split)
                 ) ;append
               ) ;blog-blocks-of
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-take xs n)
      (cond ((<= n 0) '())
            ((null? xs) '())
            (else (cons (car xs) (blog-take (cdr xs) (- n 1))))
      ) ;cond
    ) ;define

    (define (blog-emit-node node)
      (cond ((string? node) node)
            ((not (pair? node)) "")
            ((blog-head-is? (car node) "document")
             (blog-emit-mixed (cdr node))
            ) ;
            ((blog-head-name-in? (car node)
               (list "chapter" "chapter*" "section" "section*" "subsection"
                 "subsection*" "subsubsection" "subsubsection*" "paragraph"
                 "paragraph*"
               ) ;list
             ) ;blog-head-name-in?
             (let ((title (blog-inline (cdr node))))
               (cond ((string-null? title) "")
                     (else
                      (string-append
                        (blog-repeat-string "#" (blog-heading-level-of (car node)))
                        " "
                        title
                      ) ;string-append
                     ) ;else
               ) ;cond
             ) ;let
            ) ;
            ((blog-head-name-in? (car node) (list "equation*" "eqnarray*" "align"))
             (string-append "$$" (blog-math-source node) "$$")
            ) ;
            ((blog-code-head? (car node)) (blog-code-block (car node) node))
            ((blog-head-name-in? (car node) (list "itemize" "enumerate" "itemized-list" "enumerated-list"))
             (blog-emit-list node)
            ) ;
            ((blog-head-name-in? (car node) (list "tformat" "block" "wide-block"))
             (let ((table (blog-find-table-node node)))
               (cond (table (blog-table->markdown table))
                     (else (blog-emit-mixed (cdr node)))
               ) ;cond
             ) ;let
            ) ;
            ((blog-head-is? (car node) "table") (blog-table->markdown node))
            ((blog-head-name-in? (car node) (list "big-figure" "small-figure" "figure"))
             (blog-figure->markdown node)
            ) ;
            ((blog-head-is? (car node) "image") (blog-image-source node))
            ((blog-head-is? (car node) "quote-env")
             (blog-quote-lines (blog-emit-mixed (cdr node)))
            ) ;
            ((blog-head-name-in? (car node) (list "concat" "text" "strong" "em" "with"))
             (blog-inline (list node))
            ) ;
            (else (blog-emit-mixed (cdr node)))
      ) ;cond
    ) ;define

    (define (blog-heading-level-of head)
      (cond ((blog-head-name-in? head (list "chapter" "chapter*")) 1)
            ((blog-head-name-in? head (list "section" "section*")) 2)
            ((blog-head-name-in? head (list "subsection" "subsection*")) 3)
            ((blog-head-name-in? head (list "subsubsection" "subsubsection*")) 4)
            ((blog-head-name-in? head (list "paragraph" "paragraph*")) 5)
            (else 6)
      ) ;cond
    ) ;define

    (define (blog-find-table-node node)
      (cond ((not (pair? node)) #false)
            ((blog-head-is? (car node) "table") node)
            (else (blog-find-table-node-c (cdr node)))
      ) ;cond
    ) ;define

    (define (blog-find-table-node-c children)
      (cond ((null? children) #false)
            (else (let ((found (blog-find-table-node (car children))))
                    (cond (found found) (else (blog-find-table-node-c (cdr children))))
                  ) ;let
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-quote-lines text)
      (blog-join-lines (map (lambda (l) (string-append "> " l)) (string-split text "\n")))
    ) ;define

    ;; ---------------------------------------------------------------------
    ;; equation*/align content is one element (often concat); math nodes are expressions.
    ;; ---------------------------------------------------------------------

    (define (blog-is-metadata? node)
      (and (pair? node)
        (memq (car node)
          (list 'doc-data 'doc-data* 'table-of-contents 'at 'at* 'at-left
            'at-right 'graphics 'shaded-hrule 'hrule 'assign
            'thebibliography 'tag 'captions-long 'captions-short
          ) ;list
        ) ;memq
      ) ;and
    ) ;define

    (define (blog-unwrap-document node)
      (if (and (pair? node)
            (eq? (car node) 'document)
            (pair? (cdr node))
            (pair? (cadr node))
            (eq? (car (cadr node)) 'document)
          ) ;and
        (cadr node)
        (if (and (pair? node) (eq? (car node) 'document) (pair? (cdr node)))
          (cadr node)
          node
        ) ;if
      ) ;if
    ) ;define

    (define (blog-anti-quote x)
      (cond ((and (pair? x) (eq? (car x) 'quasiquote)) (cadr x))
            ((and (pair? x) (eq? (car x) 'quote)) (cadr x))
            (else x)
      ) ;cond
    ) ;define

    (define (blog-body-node doc)
      (let ((found (blog-find-deep
                     (lambda (n) (and (pair? n) (eq? (car n) 'body))) (cdr doc)
                   ) ;blog-find-deep
                   ) ;
            ) ;
        (if found found (blog-find-deep (lambda (n) (eq? n 'body)) (cdr doc)))
      ) ;let
    ) ;define

    (define (blog-body-key? x)
      (and (symbol? x) (string=? (symbol->string x) "body"))
    ) ;define

    (define (blog-document-node? x)
      (and (pair? x) (symbol? (car x)) (string=? (symbol->string (car x)) "document"))
    ) ;define

    (define (blog-body-entry doc)
      (cond ((and (pair? doc) (pair? (cdr doc))) (cadr doc))
            (else '())
      ) ;cond
    ) ;define

    (define (blog-body-contents doc)
      (let ((entry (blog-body-entry doc)))
        (cond ((not (pair? entry)) '())
              ((null? (cdr entry)) '())
              (else
               (let ((content (cadr entry)))
                 (cond ((blog-document-node? content) (cdr content))
                       ((pair? content) content)
                       (else (list content))
                 ) ;cond
               ) ;let
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-doc-body-stree doc)
      (let ((contents (catch #t (lambda () (blog-body-contents doc)) (lambda errs '()))))
        (if (null? contents)
          (catch #t (lambda () (cdr doc)) (lambda errs '()))
          contents
        ) ;if
      ) ;let
    ) ;define

    (define (blog-markdown stree-title stree)
      (let ((body (blog-doc-body-stree stree)))
        (let* ((title (blog-trim (blog-as-string stree-title)))
               (text (blog-blocks-of body))
               (text (blog-drop-title-line title text))
              ) ;
          (cond ((string-null? title) text)
                ((string-starts? (blog-trim text) "# ") text)
                (else (string-append "# " title "\n\n" text))
          ) ;cond
        ) ;let*
      ) ;let
    ) ;define

    (define (blog-drop-title-line title text)
      (cond ((string-null? title) text)
            ((not (string-starts? text title)) text)
            (else
             (blog-lines-after (string-split text "\n") title)
            ) ;else
      ) ;cond
    ) ;define

    (define (blog-lines-after lines title)
      (cond ((null? lines) "")
            ((string=? (blog-trim (car lines)) title)
             (blog-join-lines (blog-drop-blank-head (cdr lines)))
            ) ;
            ((string=? (blog-trim (car lines)) "") (blog-lines-after (cdr lines) title))
            (else (blog-join-lines lines))
      ) ;cond
    ) ;define

    (define (blog-drop-blank-head lines)
      (cond ((null? lines) lines)
            ((string=? (blog-trim (car lines)) "") (blog-drop-blank-head (cdr lines)))
            (else lines)
      ) ;cond
    ) ;define

    (define (blog-yaml-quote s)
      (string-append "\"" (string-replace (blog-as-string s) "\"" "\\\"") "\"")
    ) ;define

    (define (blog-tags-for v)
      (cond ((list? v) v)
            ((string? v) (if (string-null? v) '() (list v)))
            (else '())
      ) ;cond
    ) ;define

    (define (blog-yaml-list tags)
      (cond ((null? tags) "[]")
            (else (string-append "[" (blog-yaml-join tags) "]"))
      ) ;cond
    ) ;define

    (define (blog-yaml-join tags)
      (cond ((null? tags) "")
            ((null? (cdr tags)) (blog-yaml-scalar (car tags)))
            (else (string-append (blog-yaml-scalar (car tags)) ", " (blog-yaml-join (cdr tags))))
      ) ;cond
    ) ;define

    (define (blog-front-matter title date category tags summary)
      (let* ((lines (list "---"
                      (string-append "title: " (blog-yaml-quote title))
                      (string-append "date: " date)
                      (string-append "category: " (blog-yaml-quote category))
                      (string-append "tags: " (blog-yaml-list tags))
                      (string-append "summary: " (blog-yaml-quote summary))
                      "draft: false"
                      "---"
                    ) ;list
             ) ;
            ) ;
        (blog-join-lines lines)
      ) ;let*
    ) ;define

(define (blog-yaml-scalar s)
      (let ((v (blog-as-string s)))
        (if (string-null? v)
          "untitled"
          (if (or (blog-string-has? v #\,)
                (blog-string-has? v (integer->char 34))
                (blog-string-has? v (integer->char 39))
              ) ;or
            (blog-yaml-quote v)
            v
          ) ;if
        ) ;if
      ) ;let
    ) ;define

    (define (blog-join-front title category raw-tags summary markdown)
      (blog-front-matter title (blog-today) category (blog-tags-for raw-tags) summary)
    ) ;define

    (define (blog-make title category tags file docs-dir stree)
      (list (cons "title" (blog-as-string title))
        (cons "category" (blog-as-string category))
        (cons "tags" (blog-tags-for tags))
        (cons "file" (blog-as-string file))
        (cons "docs-dir" (blog-as-string docs-dir))
        (cons "stree" stree)
      ) ;list
    ) ;define

    (define (blog-field docs key)
      (blog-field-in docs key)
    ) ;define

    (define (blog-field-in docs key)
      (cond ((null? docs) "")
            ((and (pair? (car docs)) (string=? (car (car docs)) key))
             (cdr (car docs))
            ) ;
            (else (blog-field-in (cdr docs) key))
      ) ;cond
    ) ;define

    
    (define (blog-assoc-string key alist)
      (cond ((null? alist) #f)
            ((and (pair? (car alist)) (string=? (car (car alist)) key)) (car alist))
            (else (blog-assoc-string key (cdr alist)))
      ) ;cond
    ) ;define

    (define (blog-summary-of markdown)
      (let loop
        ((lines (string-split markdown "\n")) (out ""))
        (cond ((null? lines) out)
              (else
               (let ((l (blog-trim (car lines))))
                 (cond ((blog-skip-line? l) (loop (cdr lines) out))
                       ((string-null? out) (loop (cdr lines) l))
                       (else (loop (cdr lines) (string-append out " " l)))
                 ) ;cond
               ) ;let
              ) ;else
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-skip-line? l)
      (or (string-null? l)
        (string-starts? l "#")
        (string-starts? l "```")
        (string-starts? l "---")
        (string-starts? l "$$")
        (string-starts? l "|")
        (string-starts? l ">")
      ) ;or
    ) ;define

    (define (blog-truncate-summary s)
      (cond ((> (string-length s) 140)
             (string-append (substring s 0 140) " ..."))
            (else s)
      ) ;cond
    ) ;define

    ;; equation*/align content is one element (often concat); math nodes are expressions.
    (define (blog-export-doc-from-file script-file out)
      (call-with-output-file out
        (lambda (port)
          (let ((args (call-with-input-file script-file (lambda (p) (read p)))))
            (display (blog-export-doc! (apply blog-make (append args (list (list 'stree (list-ref args 4)))))) port)
          ) ;let
        ) ;lambda
      ) ;call-with-output-file
    ) ;define

    (define (blog-export-doc! docs)
      (blog-export-core docs #f)
    ) ;define

    (define (blog-export-core docs publish?)
      (catch #t
        (lambda ()
          (let* ((base (blog-posts-dir))
                 (file (blog-field docs "file"))
                 (docs-dir (blog-field docs "docs-dir"))
                 (title (blog-field docs "title"))
                 (category (blog-field docs "category"))
                 (raw-tags (blog-field docs "tags"))
                 (slug (blog-unique-slug base (blog-slug-for file docs-dir)))
                 (markdown (blog-markdown title (blog-field docs "stree")))
                 (summary (blog-truncate-summary (blog-summary-of markdown)))
                 (text (blog-export-text title category raw-tags summary markdown))
                 (target (path-join (path base) (string-append slug ".md")))
                ) ;
            (path-write-text target text)
            (blog-note "FILE|" (path->string target))
            (blog-note "SLUG|" slug)
            (blog-note "TITLE|" title)
            (blog-note "CHARS|" (number->string (string-length markdown)))
            (cond (publish? (blog-run-publish (blog-site-dir) title))
                  (else (path->string target))
            ) ;cond
          ) ;let*
        ) ;lambda
        (lambda errs (blog-note "ERR|" (object->string (cdr errs))) "")
      ) ;catch
    ) ;define

    (define (blog-posts-dir)
      (let* ((site (blog-site-dir))
             (sub (blog-as-string (blog-cfg "postsDir")))
             (sub (if (string-null? sub) "content/posts" sub))
            ) ;
        (blog-join (blog-join site sub) "")
      ) ;let*
    ) ;define

    (define (blog-export-text title category raw-tags summary markdown)
      (let ((fm (blog-join-front title category raw-tags summary markdown)))
        (string-append fm "\n\n" markdown "\n")
      ) ;let
    ) ;define

    (define (blog-slug-for file docs-dir)
      (let ((stem (blog-stem-path file)))
        (cond ((or (not (string? file)) (string-null? file))
               (string-append "post-" (blog-today))
              ) ;
              ((string-null? stem) "post")
              (else (blog-file-slug stem docs-dir))
        ) ;cond
      ) ;let
    ) ;define

    (define (blog-run-publish site title)
      (let* ((script (blog-as-string (blog-cfg "publishScript")))
             (cmd (blog-publish-command site script title))
            ) ;
        (blog-note "STEP|building and pushing")
        (let ((code (catch #t (lambda () (os-call cmd)) (lambda errs -1))))
          (cond ((= code 0) (blog-note "OK|published"))
                ((= code 1) (blog-note "ERR|publish.cmd exited with 1"))
                (else (blog-note "ERR|publish.cmd did not finish"))
          ) ;cond
          code
        ) ;let
      ) ;let*
    ) ;define

        (define (blog-publish-command site script title)
      (let* ((message (string-append "post: " title " (" (blog-today) ")"))
             (message (string-replace message "%" "%%"))
             (script-path (string-append site "/" script))
            ) ;
        (string-append "\"" script-path "\" -Message \"" message "\"")
      ) ;let*
    ) ;define

    (define (blog-publish-doc! docs)
      (blog-export-core docs #true)
    ) ;define

  ) ;begin
) ;define-library